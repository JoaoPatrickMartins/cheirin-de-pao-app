import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { Prisma, NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

/** Parâmetros de listagem de solicitações de gancho. */
export interface ListHooksParams {
  q?: string
  status?: 'pending' | 'delivered' | 'all'
  sort?: 'recent' | 'name'
  page?: number
  limit?: number
}

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

/**
 * AdminHooksService — gestão das solicitações de gancho de porta pelo Admin.
 *
 * Uma solicitação existe quando o cliente confirmou o gancho (hookRequestedAt != null).
 * Pendente = sem hookDeliveredAt; Entregue = com hookDeliveredAt.
 */
export class AdminHooksService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Lista solicitações de gancho (clientes com hookRequestedAt != null) com busca,
   * filtro pendente/entregue, ordenação e paginação (skip/take no banco).
   * Resolve o nome do condomínio em UMA query batch (evita N+1).
   */
  async list(params: ListHooksParams = {}) {
    const { q, status = 'pending', sort = 'recent', page = 1, limit = 20 } = params

    const where: Prisma.UserWhereInput = { role: 'CLIENT', hookRequestedAt: { not: null } }
    // Prisma + Mongo: `{ hookDeliveredAt: null }` NÃO casa documentos com o campo AUSENTE
    // (quem nunca teve entrega — o campo nunca foi gravado). Usa o operador explícito
    // do Prisma-Mongo: pendente = campo não setado; entregue = presente (not null).
    if (status === 'pending') where.hookDeliveredAt = { isSet: false }
    else if (status === 'delivered') where.hookDeliveredAt = { not: null }

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
      where.OR = or
    }

    const orderBy: Prisma.UserOrderByWithRelationInput =
      sort === 'name' ? { name: 'asc' } : { hookRequestedAt: 'desc' }

    const [total, clients] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          apartment: true,
          block: true,
          condominiumId: true,
          hookRequestedAt: true,
          hookDeliveredAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // Resolve nomes de condomínio em UMA query batch
    const condoIds = [...new Set(clients.map((c) => c.condominiumId).filter((v): v is string => !!v))]
    const condoMap = new Map<string, string>()
    if (condoIds.length > 0) {
      const condos = await this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true },
      })
      for (const c of condos) condoMap.set(c.id, c.name)
    }

    const items = clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      apartment: c.apartment ?? null,
      block: c.block ?? null,
      condominiumId: c.condominiumId ?? null,
      condominiumName: c.condominiumId ? condoMap.get(c.condominiumId) ?? null : null,
      hookRequestedAt: c.hookRequestedAt,
      hookDeliveredAt: c.hookDeliveredAt,
    }))

    return { items, total, page, limit }
  }

  /**
   * Marca a entrega do gancho como realizada (auditável). Idempotente — se já
   * entregue, não re-notifica. Ao transicionar pendente→entregue, dispara push
   * OneSignal (best-effort) e persiste notificação in-app HOOK_DELIVERED.
   *
   * @throws { statusCode: 404 } se cliente não encontrado
   * @throws { statusCode: 422 } se o cliente não solicitou o gancho
   */
  async markDelivered(clientId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true, role: true, hookRequestedAt: true, hookDeliveredAt: true, oneSignalPlayerId: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }
    if (!user.hookRequestedAt) {
      throw { statusCode: 422, message: 'Cliente não solicitou o gancho' }
    }
    if (user.hookDeliveredAt) {
      // Idempotente: já entregue — não re-notifica.
      return { ok: true }
    }

    await this.prisma.user.update({
      where: { id: clientId },
      data: { hookDeliveredAt: new Date(), hookDeliveredById: adminId },
    })

    // Push OneSignal — best-effort (falha silenciosa)
    if (user.oneSignalPlayerId) {
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
      userId: clientId,
      type: NotificationType.HOOK_DELIVERED,
      title: 'Seu gancho chegou!',
      body: 'Deixamos o gancho do Cheirin de Pão na sua porta. É só encaixar e pronto — seu pão fresquinho já pode ser entregue.',
      actionRoute: '/client/home',
    })

    return { ok: true }
  }
}
