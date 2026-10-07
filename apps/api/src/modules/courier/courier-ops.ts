import type { FastifyInstance } from 'fastify'
import { NotificationType, type PrismaClient } from '@prisma/client'
import {
  ACCESS_FIELD_LABELS,
  INCIDENT_LABELS,
  STOP_ISSUE_LABELS,
  recadoText,
  type AccessField,
  type IncidentType,
  type StopIssueType,
} from '@cheirin-de-pao/shared'
import { brtDateStr, brtDayRange } from '../../lib/cutoff.js'
import { resolveCourierRules } from '../../lib/courier-profile.js'
import { isStorageConfigured, StorageError, uploadPrivateImage } from '../../lib/storage.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { AdminHooksService } from '../admin-hooks/admin-hooks.service.js'

/**
 * Operação do entregador (plano do entregador, Onda 8): recado ao cliente (E16), problema numa
 * entrega realizada (E11), ocorrência (E12), sugestão de acesso do condomínio (E7) e o desfecho do
 * gancho enviado na rota (A7). Cada um avisa quem precisa — o cliente ou a operação.
 */

type Db = PrismaClient

/** Parada pelo id do pão ou de uma Cestinha, só se for do próprio entregador. */
async function findStop(prisma: Db, courierId: string, stopKey: string) {
  const order = await prisma.order.findFirst({
    where: { id: stopKey, courierId },
    select: { id: true, userId: true, slotId: true, scheduledDate: true, status: true },
  })
  if (order) return { kind: 'BREAD' as const, orderId: order.id, marketOrderId: null as string | null, ...order }
  const mk = await prisma.marketOrder.findFirst({
    where: { id: stopKey, courierId },
    select: { id: true, userId: true, slotId: true, scheduledDate: true, status: true },
  })
  if (mk) return { kind: 'MARKET' as const, orderId: null as string | null, marketOrderId: mk.id, ...mk }
  return null
}

/** "Apto 204 · Bloco 1, Residencial Jardins" — o lugar da parada para o aviso da operação. */
async function placeOf(prisma: Db, userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { apartment: true, block: true, condominiumId: true } })
  const condo = u?.condominiumId ? await prisma.condominium.findUnique({ where: { id: u.condominiumId }, select: { name: true } }) : null
  const unit = [u?.apartment ? `Apto ${u.apartment}` : null, u?.block ? `Bloco ${u.block}` : null].filter(Boolean).join(' · ')
  return [unit, condo?.name].filter(Boolean).join(', ')
}

const shortName = (name: string | null | undefined) => {
  const p = (name ?? 'Entregador').trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
}

/**
 * O gancho enviado na rota volta para a fila ("ficou para outro dia"). Chamado também quando a
 * parada termina como NÃO entregue — sem entrega, o gancho não foi deixado — com o motivo dela,
 * que o card do admin mostra. Nunca lança.
 */
export async function returnHookToQueue(
  prisma: Db,
  where: { userId: string; date: string; slotId: string },
  now: Date = new Date(),
  reason: string | null = null,
): Promise<number> {
  try {
    const res = await prisma.hookRequest.updateMany({
      where: { userId: where.userId, status: 'REQUESTED', routeDate: where.date, routeSlotId: where.slotId },
      data: { routeDate: null, routeSlotId: null, routeCourierId: null, routeFailedAt: now, routeFailedReason: reason },
    })
    return res.count
  } catch {
    return 0
  }
}

export class CourierOpsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  private async courierName(courierId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: courierId }, select: { name: true, courierRules: true } })
    return { name: u?.name ?? 'Entregador', rules: resolveCourierRules(u?.courierRules) }
  }

  /**
   * E16 · recado pronto ao cliente (T-16). Push "Antônio: Estou na portaria 🥖".
   * @throws 400 modelo inválido · 403 sem permissão · 404 parada · 409 `OPT_OUT` ou `ALREADY`
   */
  async sendMessage(courierId: string, input: { stopKey: string; template: string }, now: Date = new Date()): Promise<{ sentAt: string }> {
    const text = recadoText(input.template)
    if (!text) throw { statusCode: 400, message: 'Recado inválido' }
    const { name, rules } = await this.courierName(courierId)
    if (!rules.podeRecados) throw { statusCode: 403, message: 'A operação não liberou recados para você.' }
    const stop = await findStop(this.prisma, courierId, input.stopKey)
    if (!stop) throw { statusCode: 404, message: 'Parada não encontrada' }
    const today = brtDateStr(now)
    if (brtDateStr(stop.scheduledDate) !== today) throw { statusCode: 409, code: 'NOT_TODAY', message: 'Recado só vale para as entregas de hoje.' }
    const client = await this.prisma.user.findUnique({ where: { id: stop.userId }, select: { name: true, courierMessagesOff: true } })
    if (client?.courierMessagesOff === true) throw { statusCode: 409, code: 'OPT_OUT', message: 'O cliente desligou os recados do entregador.' }
    try {
      await this.prisma.courierMessage.create({ data: { courierId, userId: stop.userId, date: today, template: input.template, sentAt: now } })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw { statusCode: 409, code: 'ALREADY', message: 'Este recado já foi enviado hoje.' }
      throw err
    }
    const first = name.trim().split(/\s+/)[0] || 'Entregador'
    try {
      await new NotificationsService(this.fastify).notifyUser(stop.userId, {
        type: NotificationType.COURIER_MESSAGE,
        title: `${first}: ${text} 🥖`,
        body: 'Recado do seu entregador',
        actionRoute: '/client/pedidos',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[courier-ops] falha ao entregar o recado — gravado mesmo assim')
    }
    return { sentAt: now.toISOString() }
  }

  /** Foto opcional da ocorrência (E12): pasta PRIVADA `reports/`. Devolve a chave. */
  async uploadReportPhoto(body: Buffer, contentType: string): Promise<{ photoKey: string }> {
    if (!isStorageConfigured()) throw { statusCode: 503, message: 'Armazenamento de fotos não configurado.' }
    try {
      return { photoKey: await uploadPrivateImage(body, contentType, 'reports') }
    } catch (err) {
      if (err instanceof StorageError) throw { statusCode: 400, message: err.message }
      throw err
    }
  }

  /**
   * E11 (problema numa entrega realizada) e E12 (ocorrência). Idempotente pelo `clientOpId` (fila
   * offline). A entrega NÃO é desfeita: a operação recebe o aviso e resolve (A1, H-2).
   * @throws 400 · 404 parada
   */
  async report(
    courierId: string,
    input: { kind: 'STOP_ISSUE' | 'INCIDENT'; stopKey?: string; type: string; text?: string | null; photoKey?: string | null; clientOpId?: string },
  ): Promise<{ id: string; createdAt: string }> {
    if (input.clientOpId) {
      const again = await this.prisma.courierReport.findFirst({ where: { courierId, clientOpId: input.clientOpId }, select: { id: true, createdAt: true } })
      if (again) return { id: again.id, createdAt: again.createdAt.toISOString() }
    }
    const text = input.text?.trim() || null
    if (input.type === 'OUTRO' && (text?.length ?? 0) < 3) throw { statusCode: 400, message: 'Conte o que aconteceu' }
    if (input.photoKey && !/^reports\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(input.photoKey)) throw { statusCode: 400, message: 'Foto inválida' }
    const { name } = await this.courierName(courierId)

    let orderId: string | null = null
    let marketOrderId: string | null = null
    let title: string
    let body: string
    let type: NotificationType
    if (input.kind === 'STOP_ISSUE') {
      if (!(input.type in STOP_ISSUE_LABELS)) throw { statusCode: 400, message: 'Tipo de problema inválido' }
      if (!input.stopKey) throw { statusCode: 400, message: 'Informe a entrega' }
      const stop = await findStop(this.prisma, courierId, input.stopKey)
      if (!stop) throw { statusCode: 404, message: 'Entrega não encontrada' }
      if (stop.status !== 'DELIVERED' && stop.status !== 'NOT_DELIVERED') throw { statusCode: 400, message: 'Só dá para reportar entrega já realizada' }
      orderId = stop.orderId
      marketOrderId = stop.marketOrderId
      type = NotificationType.ADMIN_COURIER_ISSUE
      title = 'Problema reportado'
      body = `${shortName(name)}: “${STOP_ISSUE_LABELS[input.type as StopIssueType]}” · ${await placeOf(this.prisma, stop.userId)}${text ? ` — ${text}` : ''}`
    } else {
      if (!(input.type in INCIDENT_LABELS)) throw { statusCode: 400, message: 'Tipo de ocorrência inválido' }
      type = NotificationType.ADMIN_COURIER_INCIDENT
      title = 'Ocorrência do entregador'
      body = `${shortName(name)} · ${INCIDENT_LABELS[input.type as IncidentType]}${text ? `: ${text}` : ''}${input.photoKey ? ' (com foto)' : ''}`
    }

    let created
    try {
      created = await this.prisma.courierReport.create({
        data: {
          kind: input.kind,
          courierId,
          orderId,
          marketOrderId,
          type: input.type,
          text,
          photoUrl: input.photoKey ?? null,
          status: 'OPEN',
          ...(input.clientOpId ? { clientOpId: input.clientOpId } : {}),
        },
      })
    } catch (err) {
      // Corrida da fila offline: o mesmo `clientOpId` entrou por outro envio.
      if ((err as { code?: string }).code === 'P2002' && input.clientOpId) {
        const again = await this.prisma.courierReport.findFirst({ where: { courierId, clientOpId: input.clientOpId }, select: { id: true, createdAt: true } })
        if (again) return { id: again.id, createdAt: again.createdAt.toISOString() }
      }
      throw err
    }
    try {
      await new NotificationsService(this.fastify).notifyAdmins({ type, title, body: body.slice(0, 300), actionRoute: '/admin' })
    } catch (err) {
      this.fastify.log.warn({ err }, '[courier-ops] falha ao avisar a operação — reporte gravado')
    }
    return { id: created.id, createdAt: created.createdAt.toISOString() }
  }

  /** E7 · "Sugerir correção" do acesso. Repetir a mesma sugestão pendente não duplica. @throws 404 */
  async suggestAccess(courierId: string, condominiumId: string, input: { field: AccessField; text: string }): Promise<{ id: string }> {
    const condo = await this.prisma.condominium.findUnique({ where: { id: condominiumId }, select: { id: true, name: true } })
    if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    const text = input.text.trim()
    const same = await this.prisma.condoAccessSuggestion.findFirst({
      where: { condominiumId, courierId, field: input.field, text, status: 'PENDING' },
      select: { id: true },
    })
    if (same) return same
    const created = await this.prisma.condoAccessSuggestion.create({ data: { condominiumId, courierId, field: input.field, text, status: 'PENDING' } })
    try {
      const { name } = await this.courierName(courierId)
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_CONDO_ACCESS_SUGGESTION,
        title: 'Sugestão de acesso',
        body: `${condo.name} · ${ACCESS_FIELD_LABELS[input.field]}: “${text}” — ${shortName(name)}`.slice(0, 300),
        actionRoute: '/admin',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[courier-ops] falha ao avisar a sugestão de acesso — gravada')
    }
    return { id: created.id }
  }

  /**
   * A7 · "Deixou o gancho também?" — sim: entregue pelo entregador (push "Seu gancho chegou!");
   * não: volta para a fila ("ficou para outro dia"). Idempotente.
   * @throws 404 gancho fora da rota do entregador hoje
   */
  async hookOutcome(courierId: string, hookId: string, delivered: boolean, now: Date = new Date()): Promise<{ status: 'DELIVERED' | 'QUEUE' }> {
    const hook = await this.prisma.hookRequest.findUnique({
      where: { id: hookId },
      select: { id: true, userId: true, status: true, routeDate: true, routeSlotId: true, routeCourierId: true },
    })
    if (!hook) throw { statusCode: 404, message: 'Gancho não encontrado' }
    if (hook.status === 'DELIVERED') return { status: 'DELIVERED' }
    const today = brtDateStr(now)
    if (hook.status !== 'REQUESTED' || hook.routeDate !== today) {
      if (!delivered) return { status: 'QUEUE' }
      throw { statusCode: 404, message: 'Este gancho não está na sua rota de hoje' }
    }
    // O gancho é da parada do cliente: o entregador precisa ter a parada dele hoje, no turno.
    if (hook.routeCourierId && hook.routeCourierId !== courierId) throw { statusCode: 404, message: 'Este gancho não está na sua rota de hoje' }
    if (!hook.routeCourierId) {
      // Só a parada de HOJE: sem o filtro de data, um pedido futuro do mesmo cliente com este
      // entregador vinha primeiro e o "Sim" virava 404.
      const where = { courierId, userId: hook.userId, slotId: hook.routeSlotId ?? undefined, scheduledDate: { gte: brtDayRange(now).start, lte: brtDayRange(now).end } }
      const mine = await this.prisma.order.findFirst({ where, select: { id: true } })
      const mk = mine ? null : await this.prisma.marketOrder.findFirst({ where, select: { id: true } })
      if (!mine && !mk) throw { statusCode: 404, message: 'Este gancho não está na sua rota de hoje' }
    }
    if (delivered) {
      await new AdminHooksService(this.fastify).markDelivered(hook.id, courierId, 'COURIER')
      return { status: 'DELIVERED' }
    }
    await returnHookToQueue(this.prisma, { userId: hook.userId, date: today, slotId: hook.routeSlotId ?? '' }, now)
    return { status: 'QUEUE' }
  }
}
