import { FastifyInstance } from 'fastify'
import { CreateCondominiumBody, UpdateCondominiumBody, SlotUpdateBody } from './admin-condominiums.schema.js'

/**
 * AdminCondominiumsRepository — acesso ao banco para operações CRUD de condomínios.
 * Padrão: private get prisma() de payments.repository.ts.
 */
export class AdminCondominiumsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.condominium.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.condominium.findUnique({ where: { id } })
  }

  create(data: CreateCondominiumBody & { deliverySlots?: Array<{ name: string; time: string; cutoffTime: string; isActive: boolean }> }) {
    return this.prisma.condominium.create({ data })
  }

  update(id: string, data: UpdateCondominiumBody) {
    return this.prisma.condominium.update({ where: { id }, data })
  }

  remove(id: string) {
    return this.prisma.condominium.delete({ where: { id } })
  }

  async updateSlot(id: string, slotName: string, patch: SlotUpdateBody) {
    const condo = await this.findById(id)
    if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }

    const slotExists = condo.deliverySlots.some((s) => s.name === slotName)
    if (!slotExists) throw { statusCode: 404, message: 'Slot não encontrado' }

    const updatedSlots = condo.deliverySlots.map((s) =>
      s.name === slotName ? { ...s, ...patch } : s,
    )

    return this.prisma.condominium.update({
      where: { id },
      data: { deliverySlots: updatedSlots },
    })
  }
}
