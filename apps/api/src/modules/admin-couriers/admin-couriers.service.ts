import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { offReasonFor, vehicleUsesFuel, type OffReason } from '@cheirin-de-pao/shared'
import { CreateCourierBody, UpdateCourierBody } from './admin-couriers.schema.js'
import { resolveCourierRules } from '../../lib/courier-profile.js'
import { assignBadgeNumber, defaultBadgeValidity, validityToDate, validityToDay } from '../../lib/courier-badge.js'
import { brtDateStr, brtDayRange } from '../../lib/cutoff.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { uploadImage, StorageError } from '../../lib/storage.js'

/** Tudo o que o cadastro do entregador (A3) mostra e edita. */
const COURIER_SELECT = {
  id: true,
  name: true,
  cpf: true,
  phone: true,
  email: true,
  isBlocked: true,
  createdAt: true,
  courierPhotoUrl: true,
  courierVehicle: true,
  courierRules: true,
  courierPay: true,
  courierAvailability: true,
  badgeNumber: true,
  badgeValidUntil: true,
} as const

type CourierRow = Prisma.UserGetPayload<{ select: typeof COURIER_SELECT }>

export interface CourierView {
  id: string
  name: string
  cpf: string | null
  phone: string | null
  email: string | null
  isBlocked: boolean
  createdAt: string
  photoUrl: string | null
  vehicle: Record<string, unknown> | null
  rules: { fotoEntrega: boolean; fotoNaoEntrega: boolean; podeReordenar: boolean; podeRecados: boolean }
  pay: { modalidade: string | null; valor: number | null; pagaCombustivel: boolean } | null
  availability: { dias: string[]; turnos: string[] } | null
  badgeNumber: number | null
  badgeValidUntil: string | null
  /** Folga ou fora da escala HOJE (lista do A3). */
  offToday: OffReason | null
  /** Há sugestão de rota esperando o admin (A4). */
  routeSuggestion: boolean
  /** Termo do Entregador Parceiro (plano-termos-legais §6 · T-T11): a última versão aceita e quando. */
  terms: { acceptedVersion: string | null; acceptedAt: string | null }
}

/** Corpo validado → campos do `User`. Bicicleta/a pé não guardam combustível. */
function toDb(data: UpdateCourierBody): Prisma.UserUpdateInput {
  const out: Prisma.UserUpdateInput = {}
  if (data.name !== undefined) out.name = data.name
  if (data.phone !== undefined) out.phone = data.phone
  if (data.email !== undefined) out.email = data.email
  if (data.photoUrl !== undefined) out.courierPhotoUrl = data.photoUrl ?? null
  if (data.vehicle !== undefined) {
    const v = data.vehicle
    out.courierVehicle = v
      ? {
          tipo: v.tipo,
          modelo: v.modelo || null,
          placa: v.placa || null,
          combustivel: vehicleUsesFuel(v.tipo) ? v.combustivel ?? null : null,
          kmPorLitro: vehicleUsesFuel(v.tipo) ? v.kmPorLitro ?? null : null,
        }
      : null
  }
  if (data.rules !== undefined) out.courierRules = data.rules
  if (data.pay !== undefined) out.courierPay = data.pay ?? null
  if (data.availability !== undefined) out.courierAvailability = data.availability ?? null
  if (data.badgeValidUntil !== undefined) out.badgeValidUntil = data.badgeValidUntil ? validityToDate(data.badgeValidUntil) : null
  return out
}

/**
 * AdminCouriersService — lógica de negócio para gestão de entregadores.
 *
 * T-07-03-02: CPF validado no schema (Zod) antes de chegar aqui.
 *             Prisma lança P2002 em cpf duplicado — tratado no controller (409).
 * T-07-03-01: Role check ADMIN fica no controller.
 */
export class AdminCouriersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  private view(u: CourierRow, extra: { offToday?: OffReason | null; routeSuggestion?: boolean; terms?: CourierView['terms'] } = {}): CourierView {
    return {
      id: u.id,
      name: u.name,
      cpf: u.cpf ?? null,
      phone: u.phone ?? null,
      email: u.email ?? null,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt.toISOString(),
      photoUrl: u.courierPhotoUrl ?? null,
      vehicle: (u.courierVehicle ?? null) as Record<string, unknown> | null,
      rules: resolveCourierRules(u.courierRules),
      pay: (u.courierPay ?? null) as CourierView['pay'],
      availability: (u.courierAvailability ?? null) as CourierView['availability'],
      badgeNumber: u.badgeNumber ?? null,
      badgeValidUntil: validityToDay(u.badgeValidUntil),
      offToday: extra.offToday ?? null,
      routeSuggestion: extra.routeSuggestion ?? false,
      terms: extra.terms ?? { acceptedVersion: null, acceptedAt: null },
    }
  }

  async list(now: Date = new Date()): Promise<CourierView[]> {
    const today = brtDateStr(now)
    const [users, offs, templates, accepts] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'COURIER' }, select: COURIER_SELECT, orderBy: { name: 'asc' } }),
      this.prisma.courierTimeOff.findMany({ where: { startDate: { lte: today }, endDate: { gte: today } }, select: { courierId: true, startDate: true, endDate: true } }),
      this.prisma.courierRouteTemplate.findMany({ select: { courierId: true, suggestion: true } }),
      this.prisma.legalAcceptance.findMany({ where: { doc: 'COURIER_TERMS' }, orderBy: { acceptedAt: 'desc' }, select: { userId: true, version: true, acceptedAt: true } }),
    ])
    const pending = new Set(templates.filter((t) => t.suggestion && typeof t.suggestion === 'object').map((t) => t.courierId))
    const lastAccept = new Map<string, CourierView['terms']>()
    for (const a of accepts) if (!lastAccept.has(a.userId)) lastAccept.set(a.userId, { acceptedVersion: a.version, acceptedAt: a.acceptedAt.toISOString() })
    return users.map((u) =>
      this.view(u, {
        offToday: offReasonFor(u.courierAvailability as { dias?: string[]; turnos?: string[] } | null, offs.filter((o) => o.courierId === u.id), today),
        routeSuggestion: pending.has(u.id),
        terms: lastAccept.get(u.id),
      }),
    )
  }

  async create(data: CreateCourierBody, now: Date = new Date()): Promise<CourierView> {
    // Cadastro pelo admin — não exige OTP (fluxo diferente de auth.service)
    const { cpf, ...rest } = data
    const mapped = toDb({ ...rest, badgeValidUntil: rest.badgeValidUntil === undefined ? defaultBadgeValidity(now) : rest.badgeValidUntil })
    const created = await this.prisma.user.create({
      data: {
        ...(mapped as Prisma.UserCreateInput),
        name: data.name,
        cpf,
        role: 'COURIER',
        creditBalanceLegacy: 0,
        creditMilli: 0,
      },
      select: { id: true },
    })
    // Nº do crachá sequencial (H-3).
    await assignBadgeNumber(this.prisma, created.id)
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: created.id }, select: COURIER_SELECT })
    return this.view(row)
  }

  /**
   * Alterna isBlocked do entregador.
   *
   * @throws { statusCode: 404 } se user não encontrado
   * @throws { statusCode: 400 } se user não é COURIER
   */
  async toggle(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id } })

    if (!user) {
      throw { statusCode: 404, message: 'Entregador não encontrado' }
    }

    if (user.role !== 'COURIER') {
      throw { statusCode: 400, message: 'Usuário não é um COURIER' }
    }

    return this.prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked },
      select: {
        id: true,
        name: true,
        isBlocked: true,
      },
    })
  }

  /**
   * Atualiza dados do entregador (sem CPF — imutável).
   *
   * @throws { statusCode: 404 } se user não encontrado ou não é COURIER
   */
  async updateCourier(id: string, data: UpdateCourierBody): Promise<CourierView> {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'COURIER' }, select: { id: true } })

    if (!user) {
      throw { statusCode: 404, message: 'Entregador não encontrado' }
    }

    const row = await this.prisma.user.update({ where: { id }, data: toDb(data), select: COURIER_SELECT })
    return this.view(row)
  }

  /** Foto do crachá (pasta pública `couriers/`, T-6). @throws 400 imagem inválida · 503 sem S3 */
  async uploadPhoto(body: Buffer, mimetype: string): Promise<{ url: string }> {
    try {
      return { url: await uploadImage(body, mimetype, 'couriers') }
    } catch (err) {
      if (err instanceof StorageError) throw { statusCode: err.message.includes('configurado') ? 503 : 400, message: err.message }
      throw err
    }
  }

  // ── Folgas (F-8) ───────────────────────────────────────────────────────────

  private async assertCourier(id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, role: 'COURIER' }, select: { id: true } })
    if (!u) throw { statusCode: 404, message: 'Entregador não encontrado' }
  }

  /** Folgas em andamento e futuras. */
  async listTimeOffs(courierId: string, now: Date = new Date()) {
    await this.assertCourier(courierId)
    const rows = await this.prisma.courierTimeOff.findMany({
      where: { courierId, endDate: { gte: brtDateStr(now) } },
      orderBy: { startDate: 'asc' },
    })
    return rows.map((r) => ({ id: r.id, startDate: r.startDate, endDate: r.endDate, reason: r.reason ?? null }))
  }

  /**
   * Cadastra a folga. Avisa (sem bloquear) quando ela cai num dia com entregas já despachadas para o
   * entregador — a divisão daquele dia precisa ser refeita.
   */
  async addTimeOff(courierId: string, body: { startDate: string; endDate: string; reason?: string }, adminId: string) {
    await this.assertCourier(courierId)
    const row = await this.prisma.courierTimeOff.create({
      data: { courierId, startDate: body.startDate, endDate: body.endDate, reason: body.reason || null, createdById: adminId },
    })
    const start = brtDayRange(new Date(`${body.startDate}T15:00:00.000Z`)).start
    const end = brtDayRange(new Date(`${body.endDate}T15:00:00.000Z`)).end
    const [orders, markets, slots] = await Promise.all([
      this.prisma.order.findMany({ where: { courierId, scheduledDate: { gte: start, lte: end }, status: { in: ['OUT_FOR_DELIVERY'] } }, select: { scheduledDate: true, slotId: true, userId: true } }),
      this.prisma.marketOrder.findMany({ where: { courierId, scheduledDate: { gte: start, lte: end }, status: { in: ['OUT_FOR_DELIVERY'] } }, select: { scheduledDate: true, slotId: true, userId: true } }),
      getGlobalDeliverySlots(this.prisma),
    ])
    const groups = new Map<string, { date: string; slotId: string; users: Set<string> }>()
    for (const o of [...orders, ...markets]) {
      const date = brtDateStr(o.scheduledDate)
      const slotId = o.slotId ?? ''
      const k = `${date}|${slotId}`
      const g = groups.get(k) ?? { date, slotId, users: new Set<string>() }
      g.users.add(o.userId)
      groups.set(k, g)
    }
    const overlaps = [...groups.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((g) => {
        const s = slots.find((x) => x.slotId === g.slotId)
        return { date: g.date, slotId: g.slotId, slotLabel: s ? `${s.emoji ? `${s.emoji} ` : ''}${s.label}` : 'Sem turno', stops: g.users.size }
      })
    return { timeOff: { id: row.id, startDate: row.startDate, endDate: row.endDate, reason: row.reason ?? null }, overlaps }
  }

  async deleteTimeOff(courierId: string, id: string) {
    const row = await this.prisma.courierTimeOff.findUnique({ where: { id } })
    if (!row || row.courierId !== courierId) throw { statusCode: 404, message: 'Folga não encontrada' }
    await this.prisma.courierTimeOff.delete({ where: { id } })
  }
}
