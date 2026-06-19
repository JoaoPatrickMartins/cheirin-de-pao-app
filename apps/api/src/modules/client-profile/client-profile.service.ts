import { createHash, timingSafeEqual } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { ClientProfileRepository } from './client-profile.repository.js'
import { sendSmsOtp, sendEmailOtp } from '../auth/otp.service.js'
import type { UpdateProfileBody, ContactChangeRequestBody, ContactChangeConfirmBody } from './client-profile.schema.js'

export class ClientProfileService {
  private repo: ClientProfileRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new ClientProfileRepository(fastify)
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private generateOtpCode(): string {
    return process.env.OTP_DEV_CODE ?? Math.floor(1000 + Math.random() * 9000).toString()
  }

  async getProfile(userId: string) {
    const user = await this.repo.findUserById(userId)
    if (!user) return null
    const condo = user.condominiumId ? await this.repo.findCondominium(user.condominiumId) : null
    return {
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      birthDate: user.birthDate?.toISOString() ?? null,
      phone: user.phone ?? null,
      email: user.email ?? null,
      condominiumId: user.condominiumId ?? null,
      condominiumName: condo?.name ?? '',
      apartment: user.apartment ?? null,
      block: user.block ?? null,
      creditBalance: user.creditBalance,
    }
  }

  async updateProfile(userId: string, body: UpdateProfileBody) {
    const user = await this.repo.findUserById(userId)
    if (!user) return { error: 'Usuário não encontrado', status: 404 }

    const data: Parameters<ClientProfileRepository['updateProfile']>[1] = {}
    if (body.name !== undefined) data.name = body.name
    if (body.birthDate !== undefined) data.birthDate = new Date(body.birthDate)
    if (body.apartment !== undefined) data.apartment = body.apartment
    if (body.block !== undefined) data.block = body.block

    let scheduleDeactivated = false
    if (body.condominiumId !== undefined && body.condominiumId !== user.condominiumId) {
      data.condominiumId = body.condominiumId
      await this.repo.deactivateSchedules(userId)
      scheduleDeactivated = true
    }

    const updated = await this.repo.updateProfile(userId, data)
    const condo = updated.condominiumId ? await this.repo.findCondominium(updated.condominiumId) : null

    return {
      id: updated.id,
      name: updated.name,
      cpf: updated.cpf,
      birthDate: updated.birthDate?.toISOString() ?? null,
      phone: updated.phone ?? null,
      email: updated.email ?? null,
      condominiumId: updated.condominiumId ?? null,
      condominiumName: condo?.name ?? '',
      apartment: updated.apartment ?? null,
      block: updated.block ?? null,
      creditBalance: updated.creditBalance,
      scheduleDeactivated,
    }
  }

  async requestContactChange(userId: string, body: ContactChangeRequestBody) {
    const user = await this.repo.findUserById(userId)
    if (!user) return { error: 'Usuário não encontrado', status: 404 }

    const field = body.phone ? 'phone' : 'email'
    const value = (body.phone ?? body.email)!
    const conflict = await this.repo.checkContactConflict(field, value)
    if (conflict && conflict.id !== userId) {
      return { error: 'Este contato já está associado a outra conta.', status: 422 }
    }

    const code = this.generateOtpCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    // Encode new contact value in channel field as "sms:{phone}" or "email:{email}"
    // so confirmContactChange can apply the update without an extra DB lookup
    const channel = body.phone ? `sms:${body.phone}` : `email:${body.email}`
    await this.repo.createContactChangeOtp({ userId, code: this.hashValue(code), channel, expiresAt })

    if (body.phone) {
      await sendSmsOtp(body.phone, code)
    } else if (body.email) {
      await sendEmailOtp(body.email, code)
    }

    return { ok: true }
  }

  async confirmContactChange(userId: string, body: ContactChangeConfirmBody) {
    const otp = await this.repo.findActiveContactChangeOtp(userId)
    if (!otp) return { error: 'Código expirado ou não encontrado', status: 401 }

    const expectedHash = Buffer.from(this.hashValue(body.code), 'hex')
    const actualHash = Buffer.from(otp.code, 'hex')
    const match = expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
    if (!match) return { error: 'Código inválido', status: 401 }

    await this.repo.markOtpUsed(otp.id)

    // Decode contact value from channel field ("sms:{phone}" or "email:{email}")
    const colonIdx = otp.channel.indexOf(':')
    const channelType = colonIdx >= 0 ? otp.channel.slice(0, colonIdx) : otp.channel
    const contactValue = colonIdx >= 0 ? otp.channel.slice(colonIdx + 1) : ''

    const update: { phone?: string; email?: string } = {}
    if (channelType === 'sms' && contactValue) {
      update.phone = contactValue
    } else if (channelType === 'email' && contactValue) {
      update.email = contactValue
    } else {
      return { error: 'Canal inválido no OTP', status: 500 }
    }

    await this.repo.updateContact(userId, update)
    return update
  }
}
