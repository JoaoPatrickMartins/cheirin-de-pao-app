import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { Prisma, NotificationType, HookRequestType, type MarketOrderStatus, type OrderStatus } from '@prisma/client'
import { compareUnits, offReasonFor } from '@cheirin-de-pao/shared'
import { NotificationsService } from '../notifications/notifications.service.js'
import { getCondoDeliverySlots, getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { brtDateStr, brtDayRange, brtNoonFromStr, dayKeyOf } from '../../lib/cutoff.js'
import { findBlockForDate, getRulesForCondo, isDayBlocked, listBlocksOverlapping } from '../../lib/delivery-rules.js'

/** Parâmetros de listagem de solicitações de gancho. */
export interface ListHooksParams {
  q?: string
  status?: 'pending' | 'delivered' | 'all'
  type?: 'all' | 'free' | 'paid' | 'bonus'
  sort?: 'recent' | 'name' | 'location'
  page?: number
  limit?: number
}

/**
 * Ordena por bloco → complemento → apartamento com comparação numérica
 * ("Bloco 2" antes de "Bloco 10", "Apto 20" antes de "Apto 101"). Ver `compareUnits`.
 */
const byBlockThenApartment = compareUnits

/** Campos do gancho na rota (A7) — lidos na listagem. */
const ROUTE_SELECT = {
  routeDate: true,
  routeSlotId: true,
  routeCourierId: true,
  routeFailedAt: true,
  routeFailedReason: true,
  deliveredVia: true,
  deliveredById: true,
} as const

/** Dias que a folha "Enviar na rota" oferece: hoje e os próximos 6 (D-4). */
const ROUTE_WINDOW_DAYS = 7
/** Pedido que ainda vai sair. `CONFIRMED` não existe em nenhum dos dois enums — o filtro antigo derrubava a consulta. */
const OPEN_ORDER: readonly OrderStatus[] = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY']
const OPEN_MARKET: readonly MarketOrderStatus[] = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY']
/** Parada que o entregador já resolveu: não cabe mais gancho nela. */
const RESOLVED = ['DELIVERED', 'NOT_DELIVERED']
/** Linhas sem pão de verdade: cancelado ou Cestinha que nunca foi paga. */
const DEAD = ['CANCELLED', 'PENDING_PAYMENT']

export interface HookRouteCourier {
  id: string
  name: string
  photoUrl: string | null
}

export interface HookRouteOption {
  date: string
  slotId: string
  slotLabel: string
  slotEmoji: string
  slotTime: string
  /** Vai junto com o pão (pedido ou agenda). `false` = parada só de gancho. */
  withBread: boolean
  /** O pão do dia já foi despachado: o entregador é o da parada e não se escolhe. */
  courierLocked: boolean
  /** O entregador fixo (`courierLocked`) ou o sugerido (D-6). */
  courier: HookRouteCourier | null
  /** De folga, fora da escala ou com a rota do turno já encerrada. */
  unavailableCourierIds: string[]
}

type SlotRow = { kind: 'order' | 'market'; scheduledDate: Date; slotId: string | null; status: string; courierId?: string | null }
type ScheduleLike = { isActive: boolean; pausedAt: Date | null; days: unknown } | null

/**
 * O cliente tem pão naquele dia/turno (D-5)? Pedido vivo decide. Sem pedido de pão no dia, vale a
 * agenda ativa e não pausada — o pedido dela só nasce no corte. Um pedido de pão CANCELADO é o
 * cliente pulando o dia: aí a agenda não conta.
 */
function breadOnSlot(rows: SlotRow[], schedule: ScheduleLike, date: string, slotId: string): boolean {
  const mine = rows.filter((r) => brtDateStr(r.scheduledDate) === date && (r.slotId ?? '') === slotId)
  if (mine.some((r) => !DEAD.includes(r.status))) return true
  if (mine.some((r) => r.kind === 'order')) return false
  if (!schedule?.isActive || schedule.pausedAt) return false
  const days = (schedule.days ?? {}) as Record<string, Record<string, number> | undefined>
  return Number(days[slotId]?.[dayKeyOf(brtNoonFromStr(date))] ?? 0) > 0
}

/** O id mais frequente da lista (desempate: o primeiro a aparecer). */
function mostFrequent(ids: string[]): string | null {
  const count = new Map<string, number>()
  for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1)
  let best: string | null = null
  for (const [id, n] of count) if (best === null || n > count.get(best)!) best = id
  return best
}

const sameBlock = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

const TYPE_MAP: Record<'free' | 'paid' | 'bonus', HookRequestType> = {
  free: HookRequestType.FREE,
  paid: HookRequestType.PAID,
  bonus: HookRequestType.BONUS,
}

/**
 * AdminHooksService — gestão dos ganchos de porta pelo Admin (coleção HookRequest).
 *
 * A fila de entrega são os ganchos em status REQUESTED (grátis, pago confirmado ou bônus).
 * Pagamentos pendentes (PENDING_PAYMENT) e cancelados não aparecem para o admin.
 */
export class AdminHooksService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Lista ganchos (REQUESTED/DELIVERED) com busca por dados do cliente, filtro de
   * status/tipo, ordenação e paginação. Resolve nome/local do cliente e do condomínio
   * em queries batch (evita N+1). A busca resolve os userIds em uma query de User antes.
   * `sort=name` ordena a página retornada (page-local).
   */
  async list(params: ListHooksParams = {}) {
    const { q, status = 'pending', type = 'all', sort = 'recent', page = 1, limit = 20 } = params

    const where: Prisma.HookRequestWhereInput = {}
    if (status === 'pending') where.status = 'REQUESTED'
    else if (status === 'delivered') where.status = 'DELIVERED'
    else where.status = { in: ['REQUESTED', 'DELIVERED'] }

    if (type !== 'all') where.type = TYPE_MAP[type]

    // Busca por dados do cliente → resolve userIds (HookRequest não tem relação no schema Mongo).
    const term = q?.trim()
    if (term) {
      const digits = term.replace(/\D/g, '')
      const or: Prisma.UserWhereInput[] = [
        { name: { contains: term, mode: 'insensitive' } },
        { apartment: { contains: term, mode: 'insensitive' } },
        { block: { contains: term, mode: 'insensitive' } },
        { complement: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
      ]
      if (digits) {
        or.push({ cpf: { contains: digits } })
        or.push({ phone: { contains: digits } })
      }
      const matched = await this.prisma.user.findMany({
        where: { role: 'CLIENT', OR: or },
        select: { id: true },
      })
      const ids = matched.map((u) => u.id)
      if (ids.length === 0) return { items: [], total: 0, page, limit }
      where.userId = { in: ids }
    }

    // Ordenação por localização (condomínio → bloco → apartamento) depende de dados do
    // User, que só são resolvidos após a query — o banco não consegue ordenar por eles.
    // Então carregamos o conjunto filtrado COMPLETO, ordenamos e paginamos em memória.
    // Mesmo padrão já usado em courier/separação (a fila de ganchos é limitada).
    if (sort === 'location') {
      const allHooks = await this.prisma.hookRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          reason: true,
          requestedAt: true,
          deliveredAt: true,
          ...ROUTE_SELECT,
        },
      })
      const allItems = await this.enrich(allHooks)
      allItems.sort((a, b) => {
        const byCondo = (a.condominiumName ?? '').localeCompare(b.condominiumName ?? '', 'pt-BR')
        if (byCondo !== 0) return byCondo
        const byLocal = byBlockThenApartment(a, b)
        if (byLocal !== 0) return byLocal
        // Desempate estável: mais recente primeiro.
        const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0
        const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0
        return tb - ta
      })
      const start = (page - 1) * limit
      return { items: allItems.slice(start, start + limit), total: allItems.length, page, limit }
    }

    const [total, hooks] = await Promise.all([
      this.prisma.hookRequest.count({ where }),
      this.prisma.hookRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          reason: true,
          requestedAt: true,
          deliveredAt: true,
          ...ROUTE_SELECT,
        },
      }),
    ])

    let items = await this.enrich(hooks)

    if (sort === 'name') {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    }

    return { items, total, page, limit }
  }

  /**
   * Quantos ganchos estão na fila de entrega (REQUESTED) — o número do badge de Gestão.
   *
   * Contagem crua no índice `[status, requestedAt]`, sem `enrich`: o contador é buscado em
   * toda entrada no hub e não pode custar o mesmo que a listagem. Pagamentos ainda pendentes
   * (PENDING_PAYMENT) não são pendência operacional — ninguém tem gancho a entregar por eles.
   */
  async countPending() {
    const pending = await this.prisma.hookRequest.count({ where: { status: 'REQUESTED' } })
    return { pending }
  }

  /**
   * Resolve nome/local do cliente e nome do condomínio em queries batch (evita N+1)
   * e monta os itens de saída da listagem a partir dos HookRequest crus.
   */
  private async enrich(
    hooks: Prisma.HookRequestGetPayload<{
      select: {
        id: true
        userId: true
        type: true
        status: true
        reason: true
        requestedAt: true
        deliveredAt: true
        routeDate: true
        routeSlotId: true
        routeCourierId: true
        routeFailedAt: true
        routeFailedReason: true
        deliveredVia: true
        deliveredById: true
      }
    }>[],
  ) {
    // Resolve clientes em UMA query batch
    const userIds = [...new Set(hooks.map((h) => h.userId))]
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, phone: true, apartment: true, block: true, complement: true, condominiumId: true },
          })
        : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Resolve nomes de condomínio em UMA query batch
    const condoIds = [...new Set(users.map((u) => u.condominiumId).filter((v): v is string => !!v))]
    const condoMap = new Map<string, string>()
    if (condoIds.length > 0) {
      const condos = await this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true },
      })
      for (const c of condos) condoMap.set(c.id, c.name)
    }

    // Gancho na rota (A7): turno, entregador e quem entregou.
    const slots = hooks.some((h) => h.routeSlotId) ? await getGlobalDeliverySlots(this.prisma) : []
    const staffIds = [...new Set(hooks.flatMap((h) => [h.routeCourierId, h.deliveredVia === 'COURIER' ? h.deliveredById : null]).filter((v): v is string => !!v))]
    const staff = staffIds.length ? await this.prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : []
    const staffName = new Map(staff.map((x) => [x.id, x.name]))
    const today = brtDateStr(new Date())
    const breadOf = await this.breadOnRoute(hooks, userMap)

    return hooks.map((h) => {
      const u = userMap.get(h.userId)
      const slot = h.routeSlotId ? slots.find((x) => x.slotId === h.routeSlotId) : undefined
      const onRoute = h.status === 'REQUESTED' && !!h.routeDate
      return {
        id: h.id,
        userId: h.userId,
        type: h.type,
        status: h.status,
        reason: h.reason ?? null,
        requestedAt: h.requestedAt,
        deliveredAt: h.deliveredAt,
        name: u?.name ?? 'Cliente',
        phone: u?.phone ?? null,
        apartment: u?.apartment ?? null,
        block: u?.block ?? null,
        complement: u?.complement ?? null,
        condominiumId: u?.condominiumId ?? null,
        condominiumName: u?.condominiumId ? condoMap.get(u.condominiumId) ?? null : null,
        route: onRoute
          ? {
              date: h.routeDate!,
              slotId: h.routeSlotId ?? '',
              slotLabel: slot ? `${slot.emoji ? `${slot.emoji} ` : ''}${slot.label}` : h.routeSlotId ?? '',
              courierName: h.routeCourierId ? staffName.get(h.routeCourierId) ?? null : null,
              /** A data passou e o entregador não respondeu. */
              overdue: h.routeDate! < today,
              /** Sem pão no dia/turno: parada só de gancho. */
              alone: !breadOf.get(h.id),
            }
          : null,
        routeFailedAt: h.routeFailedAt ?? null,
        routeFailedReason: h.routeFailedReason ?? null,
        deliveredVia: h.deliveredVia ?? null,
        deliveredByName: h.deliveredVia === 'COURIER' && h.deliveredById ? staffName.get(h.deliveredById) ?? null : null,
        /** fila · rota · entregue · volta (não entregue na rota, de volta à fila) */
        routeState: h.status === 'DELIVERED' ? 'entregue' : onRoute && h.routeDate! >= today ? 'rota' : h.routeFailedAt || onRoute ? 'volta' : 'fila',
      }
    })
  }

  /**
   * Para cada gancho na rota: o cliente tem pão no dia/turno da rota (pedido ou agenda)? Em lote —
   * uma leitura de pedidos, Cestinhas e agendas para todos os clientes da página.
   */
  private async breadOnRoute(
    hooks: Array<{ id: string; userId: string; status: string; routeDate: string | null; routeSlotId: string | null }>,
    userMap: Map<string, { condominiumId: string | null }>,
  ): Promise<Map<string, boolean>> {
    const onRoute = hooks.filter((h) => h.status === 'REQUESTED' && !!h.routeDate)
    const out = new Map<string, boolean>()
    if (onRoute.length === 0) return out
    const userIds = [...new Set(onRoute.map((h) => h.userId))]
    const dates = onRoute.map((h) => h.routeDate!).sort()
    const inRange = { gte: brtDayRange(brtNoonFromStr(dates[0])).start, lte: brtDayRange(brtNoonFromStr(dates[dates.length - 1])).end }
    const select = { userId: true, scheduledDate: true, slotId: true, status: true } as const
    const [orders, markets, schedules] = await Promise.all([
      this.prisma.order.findMany({ where: { userId: { in: userIds }, scheduledDate: inRange }, select }),
      this.prisma.marketOrder.findMany({ where: { userId: { in: userIds }, scheduledDate: inRange }, select }),
      this.prisma.schedule.findMany({ where: { userId: { in: userIds } }, select: { userId: true, condominiumId: true, isActive: true, pausedAt: true, days: true } }),
    ])
    for (const h of onRoute) {
      const rows: SlotRow[] = [
        ...orders.filter((o) => o.userId === h.userId).map((o) => ({ ...o, kind: 'order' as const })),
        ...markets.filter((m) => m.userId === h.userId).map((m) => ({ ...m, kind: 'market' as const })),
      ]
      // A agenda que vale é a do condomínio atual do cliente.
      const schedule = schedules.find((x) => x.userId === h.userId && x.condominiumId === userMap.get(h.userId)?.condominiumId) ?? null
      out.set(h.id, breadOnSlot(rows, schedule, h.routeDate!, h.routeSlotId ?? ''))
    }
    return out
  }

  /**
   * A7 · dias e turnos em que o gancho pode ir (D-4): hoje e os próximos 6, nos turnos ativos do
   * condomínio do cliente, fora de dia bloqueado e de dia da semana sem entrega. Cada opção diz se
   * vai junto com o pão (pedido ou agenda) ou sozinho, e quem leva: o entregador da parada quando
   * o pão já foi despachado, senão uma sugestão (D-6). Turno com a parada já resolvida fica de fora.
   * @throws 404
   */
  async routeOptions(hookRequestId: string, now: Date = new Date()): Promise<{ options: HookRouteOption[]; couriers: HookRouteCourier[] }> {
    const hook = await this.prisma.hookRequest.findUnique({ where: { id: hookRequestId }, select: { userId: true } })
    if (!hook) throw { statusCode: 404, message: 'Gancho não encontrado' }
    const client = await this.prisma.user.findUnique({ where: { id: hook.userId }, select: { condominiumId: true, block: true } })
    const condoId = client?.condominiumId
    if (!condoId) return { options: [], couriers: [] }

    const dates = Array.from({ length: ROUTE_WINDOW_DAYS }, (_, i) => brtDateStr(now, i))
    const first = dates[0]
    const last = dates[dates.length - 1]
    const inWindow = { gte: brtDayRange(brtNoonFromStr(first)).start, lte: brtDayRange(brtNoonFromStr(last)).end }
    const slotSelect = { scheduledDate: true, slotId: true, status: true, courierId: true } as const

    const [slots, rules, blocks, schedule, orders, markets, staff, offs, endedRuns, templates, neighbors] = await Promise.all([
      getCondoDeliverySlots(this.prisma, condoId).catch(() => []),
      getRulesForCondo(this.prisma, condoId),
      listBlocksOverlapping(this.prisma, condoId, first, last),
      this.prisma.schedule.findUnique({
        where: { userId_condominiumId: { userId: hook.userId, condominiumId: condoId } },
        select: { isActive: true, pausedAt: true, days: true },
      }),
      this.prisma.order.findMany({ where: { userId: hook.userId, scheduledDate: inWindow }, select: slotSelect }),
      this.prisma.marketOrder.findMany({ where: { userId: hook.userId, scheduledDate: inWindow }, select: slotSelect }),
      this.prisma.user.findMany({
        where: { role: 'COURIER' },
        select: { id: true, name: true, courierPhotoUrl: true, courierAvailability: true, isBlocked: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.courierTimeOff.findMany({
        where: { startDate: { lte: last }, endDate: { gte: first } },
        select: { courierId: true, startDate: true, endDate: true },
      }),
      this.prisma.courierRun.findMany({ where: { date: { in: dates }, status: 'ENDED' }, select: { courierId: true, date: true, slotId: true } }),
      this.prisma.courierRouteTemplate.findMany({
        where: { condominiumIds: { has: condoId } },
        select: { courierId: true, slotId: true, acceptedAt: true, updatedAt: true },
      }),
      this.condoDispatched(condoId, inWindow),
    ])

    const rows: SlotRow[] = [...orders.map((o) => ({ ...o, kind: 'order' as const })), ...markets.map((m) => ({ ...m, kind: 'market' as const }))]
    const byId = new Map(staff.map((c) => [c.id, c]))
    const view = (id: string | null | undefined): HookRouteCourier | null => {
      const c = id ? byId.get(id) : undefined
      return c ? { id: c.id, name: c.name, photoUrl: c.courierPhotoUrl ?? null } : null
    }
    const activeSlots = slots.filter((x) => x.isActive).sort((a, b) => a.time.localeCompare(b.time))

    const options: HookRouteOption[] = []
    for (const date of dates) {
      if (findBlockForDate(blocks, date)) continue
      if (isDayBlocked(rules.blocked, dayKeyOf(brtNoonFromStr(date)))) continue
      for (const slot of activeSlots) {
        const mine = rows.filter((r) => brtDateStr(r.scheduledDate) === date && (r.slotId ?? '') === slot.slotId)
        if (mine.some((r) => RESOLVED.includes(r.status))) continue
        const open = mine.filter((r) => (r.kind === 'order' ? OPEN_ORDER : OPEN_MARKET).includes(r.status as never))
        const locked = open.find((r) => r.status === 'OUT_FOR_DELIVERY' && r.courierId)?.courierId ?? null

        const unavailable = new Set(
          staff
            .filter(
              (c) =>
                !!offReasonFor(c.courierAvailability as { dias?: string[]; turnos?: string[] } | null, offs.filter((o) => o.courierId === c.id), date, slot.slotId) ||
                endedRuns.some((r) => r.courierId === c.id && r.date === date && r.slotId === slot.slotId),
            )
            .map((c) => c.id),
        )
        const canTake = (id: string | null | undefined): id is string => !!id && !!byId.get(id) && !byId.get(id)!.isBlocked && !unavailable.has(id)

        let courier: HookRouteCourier | null
        if (locked) courier = view(locked)
        else {
          // 1) divisão aprovada: quem já leva pão no condomínio neste dia/turno, mesmo bloco primeiro;
          // 2) rota salva do turno que passa pelo condomínio, a aceita primeiro.
          const there = neighbors.filter((n) => n.date === date && n.slotId === slot.slotId && canTake(n.courierId))
          const byDivision = mostFrequent(there.filter((n) => sameBlock(n.block, client.block)).map((n) => n.courierId)) ?? mostFrequent(there.map((n) => n.courierId))
          const byTemplate = templates
            .filter((t) => t.slotId === slot.slotId && canTake(t.courierId))
            .sort((a, b) => Number(!!b.acceptedAt) - Number(!!a.acceptedAt) || b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.courierId
          courier = view(byDivision ?? byTemplate)
        }

        options.push({
          date,
          slotId: slot.slotId,
          slotLabel: slot.label,
          slotEmoji: slot.emoji ?? '',
          slotTime: slot.time ?? '',
          withBread: breadOnSlot(rows, schedule, date, slot.slotId),
          courierLocked: !!locked,
          courier,
          unavailableCourierIds: [...unavailable],
        })
      }
    }

    const couriers = staff.filter((c) => !c.isBlocked).map((c) => view(c.id)!)
    return { options, couriers }
  }

  /** Paradas já despachadas no condomínio (outros clientes), com o bloco de cada cliente — base da sugestão. */
  private async condoDispatched(condoId: string, inWindow: { gte: Date; lte: Date }) {
    const people = await this.prisma.user.findMany({ where: { condominiumId: condoId }, select: { id: true, block: true } })
    if (people.length === 0) return []
    const blockOf = new Map(people.map((p) => [p.id, p.block ?? null]))
    const where = { userId: { in: [...blockOf.keys()] }, scheduledDate: inWindow, status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as OrderStatus[] } }
    const select = { userId: true, slotId: true, scheduledDate: true, courierId: true } as const
    const [o, m] = await Promise.all([this.prisma.order.findMany({ where, select }), this.prisma.marketOrder.findMany({ where, select })])
    return [...o, ...m]
      .filter((r): r is typeof r & { courierId: string } => !!r.courierId)
      .map((r) => ({ courierId: r.courierId, date: brtDateStr(r.scheduledDate), slotId: r.slotId ?? '', block: blockOf.get(r.userId) ?? null }))
  }

  /**
   * A7 · "Enviar na rota". Com pão já despachado, o gancho entra na parada do cliente e o entregador
   * é o dela. Nos outros casos o admin escolhe quem leva (D-6): se o pão sair depois com outro
   * entregador na divisão, o gancho vai junto com o pão (D-7); sem pão, vira parada só de gancho.
   * @throws 400 dia/turno indisponível ou sem entregador · 404 · 422 fora da fila ou entregador indisponível
   */
  async sendOnRoute(hookRequestId: string, date: string, slotId: string, courierId?: string | null, now: Date = new Date()) {
    const hook = await this.prisma.hookRequest.findUnique({ where: { id: hookRequestId }, select: { id: true, status: true } })
    if (!hook) throw { statusCode: 404, message: 'Gancho não encontrado' }
    if (hook.status !== 'REQUESTED') throw { statusCode: 422, message: 'Este gancho não está na fila de entrega' }
    const { options, couriers } = await this.routeOptions(hookRequestId, now)
    const option = options.find((o) => o.date === date && o.slotId === slotId)
    if (!option) throw { statusCode: 400, message: 'Este dia e turno não estão disponíveis para o gancho.' }

    let who: HookRouteCourier | null
    if (option.courierLocked) who = option.courier
    else {
      if (!courierId) throw { statusCode: 400, message: 'Escolha quem leva o gancho' }
      who = couriers.find((c) => c.id === courierId) ?? null
      if (!who || option.unavailableCourierIds.includes(courierId)) throw { statusCode: 422, message: 'Este entregador não está disponível neste dia e turno' }
    }

    await this.prisma.hookRequest.update({
      where: { id: hookRequestId },
      data: { routeDate: date, routeSlotId: slotId, routeCourierId: who?.id ?? null, routeFailedAt: null, routeFailedReason: null },
    })
    return { ok: true, route: { date, slotId, courierName: who?.name ?? null, alone: !option.withBread } }
  }

  /** A7 · "Tirar da rota": volta para a fila. @throws 404 */
  async removeFromRoute(hookRequestId: string) {
    const hook = await this.prisma.hookRequest.findUnique({ where: { id: hookRequestId }, select: { id: true } })
    if (!hook) throw { statusCode: 404, message: 'Gancho não encontrado' }
    await this.prisma.hookRequest.update({ where: { id: hookRequestId }, data: { routeDate: null, routeSlotId: null, routeCourierId: null } })
    return { ok: true }
  }

  /**
   * Marca a entrega de um gancho (auditável). Idempotente — se já entregue, não re-notifica.
   * Ao transicionar REQUESTED→DELIVERED, dispara push OneSignal (best-effort) e persiste
   * a notificação in-app HOOK_DELIVERED.
   *
   * @throws { statusCode: 404 } se o gancho não existe
   * @throws { statusCode: 422 } se o gancho não está na fila (ex.: aguardando pagamento)
   */
  async markDelivered(hookRequestId: string, adminId: string, via: 'ADMIN' | 'COURIER' = 'ADMIN') {
    const hook = await this.prisma.hookRequest.findUnique({
      where: { id: hookRequestId },
      select: { id: true, userId: true, status: true },
    })
    if (!hook) {
      throw { statusCode: 404, message: 'Gancho não encontrado' }
    }
    if (hook.status === 'DELIVERED') {
      // Idempotente: já entregue — não re-notifica.
      return { ok: true }
    }
    if (hook.status !== 'REQUESTED') {
      throw { statusCode: 422, message: 'Este gancho ainda não está na fila de entrega' }
    }

    await this.prisma.hookRequest.update({
      where: { id: hookRequestId },
      // `deliveredVia`: o admin registrou ou o entregador confirmou na rota (A7). Sai da rota.
      data: { status: 'DELIVERED', deliveredAt: new Date(), deliveredById: adminId, deliveredVia: via },
    })

    const user = await this.prisma.user.findUnique({
      where: { id: hook.userId },
      select: { oneSignalPlayerId: true },
    })

    // Push OneSignal — best-effort (falha silenciosa)
    if (user?.oneSignalPlayerId) {
      try {
        const osClient = createOsClient()
        const notification = new OneSignal.Notification()
        notification.app_id = process.env.ONESIGNAL_APP_ID!
        notification.include_subscription_ids = [user.oneSignalPlayerId]
        notification.headings = { pt: 'Seu gancho chegou!' }
        notification.contents = {
          pt: 'Deixamos o gancho do Cheirin de Pão na sua porta. É só encaixar e pronto — seu pão fresquinho já pode ser entregue.',
        }
        notification.data = { screen: 'home' }
        await osClient.createNotification(notification)
      } catch (pushErr) {
        this.fastify.log.warn({ err: pushErr }, '[admin-hooks] falha ao enviar push — ignorado')
      }
    }

    // Notificação in-app obrigatória — FORA do try do push
    const notificationsService = new NotificationsService(this.fastify)
    await notificationsService.createAndTrim({
      userId: hook.userId,
      type: NotificationType.HOOK_DELIVERED,
      title: 'Seu gancho chegou!',
      body: 'Deixamos o gancho do Cheirin de Pão na sua porta. É só encaixar e pronto — seu pão fresquinho já pode ser entregue.',
      actionRoute: '/client/home',
    })

    return { ok: true }
  }

  /**
   * Concede um gancho de BONIFICAÇÃO (BONUS) a um cliente — entra direto na fila (REQUESTED).
   *
   * @throws { statusCode: 404 } se o cliente não existe
   * @throws { statusCode: 422 } se o cliente já tem um gancho em andamento
   */
  async grant(adminId: string, targetUserId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const open = await this.prisma.hookRequest.count({
      where: { userId: targetUserId, status: { in: ['PENDING_PAYMENT', 'REQUESTED'] } },
    })
    if (open > 0) {
      throw { statusCode: 422, message: 'Cliente já tem um gancho em andamento' }
    }

    const hook = await this.prisma.hookRequest.create({
      data: {
        userId: targetUserId,
        type: 'BONUS',
        status: 'REQUESTED',
        requestedAt: new Date(),
        grantedById: adminId,
        reason: reason?.trim() || null,
      },
      select: { id: true },
    })

    return { hookRequestId: hook.id }
  }
}
