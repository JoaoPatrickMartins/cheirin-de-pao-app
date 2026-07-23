import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { Prisma, NotificationType, HookRequestType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

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
 * Ordena por bloco e depois por apartamento com comparação numérica
 * ("Bloco 2" antes de "Bloco 10", "Apto 20" antes de "Apto 101").
 */
function byBlockThenApartment(
  a: { block?: string | null; apartment?: string | null },
  b: { block?: string | null; apartment?: string | null },
): number {
  const ba = (a.block ?? '').trim()
  const bb = (b.block ?? '').trim()
  if (ba !== bb) return ba.localeCompare(bb, 'pt-BR', { numeric: true })
  return (a.apartment ?? '').trim().localeCompare((b.apartment ?? '').trim(), 'pt-BR', { numeric: true })
}

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
      }
    }>[],
  ) {
    // Resolve clientes em UMA query batch
    const userIds = [...new Set(hooks.map((h) => h.userId))]
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, phone: true, apartment: true, block: true, condominiumId: true },
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

    return hooks.map((h) => {
      const u = userMap.get(h.userId)
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
        condominiumId: u?.condominiumId ?? null,
        condominiumName: u?.condominiumId ? condoMap.get(u.condominiumId) ?? null : null,
      }
    })
  }

  /**
   * Marca a entrega de um gancho (auditável). Idempotente — se já entregue, não re-notifica.
   * Ao transicionar REQUESTED→DELIVERED, dispara push OneSignal (best-effort) e persiste
   * a notificação in-app HOOK_DELIVERED.
   *
   * @throws { statusCode: 404 } se o gancho não existe
   * @throws { statusCode: 422 } se o gancho não está na fila (ex.: aguardando pagamento)
   */
  async markDelivered(hookRequestId: string, adminId: string) {
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
      data: { status: 'DELIVERED', deliveredAt: new Date(), deliveredById: adminId },
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
