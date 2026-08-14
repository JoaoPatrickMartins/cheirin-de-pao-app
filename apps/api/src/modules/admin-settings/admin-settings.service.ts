import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { NotificationType } from '@prisma/client'
import { isPastCutoffForDelivery, nextDeliveryDateStr, brtDateStr } from '../../lib/cutoff.js'
import {
  getGlobalDeliverySlots,
  setGlobalDeliverySlots,
  getCondoDeliverySlots,
  setCondoDeliverySlots,
  normalizeSlot,
  type GlobalDeliverySlot,
  type DeliverySlotView,
  type SlotPatch,
  type CondoSlotPatch,
} from '../../lib/delivery-slots.js'
import { getRulesForCondo, type ResolvedRules } from '../../lib/delivery-rules.js'
import type { WeekdayMinimums } from './admin-settings.schema.js'
import { getGanchoConfig, type GanchoConfig } from '../../lib/gancho-config.js'
import {
  WEEKDAY_ORDER,
  WEEKDAY_LABEL,
  type DiasBloqueados,
  type LimitePedidosDia,
} from '../../lib/agenda-restrictions.js'
import { NotificationsService } from '../notifications/notifications.service.js'

/**
 * Faz parse defensivo do JSON de mínimos da agenda (coluna Setting.value).
 * Cada dia é clampado para [0..12] inteiro; ausente/inválido → 0 (sem mínimo).
 * Nunca lança — docs legados/malformados degradam para "sem mínimo".
 */
export function parseAgendaMinimos(raw: string | null | undefined): WeekdayMinimums {
  let parsed: Record<string, unknown> = {}
  if (raw) {
    try {
      const obj = JSON.parse(raw) as unknown
      if (obj && typeof obj === 'object') parsed = obj as Record<string, unknown>
    } catch {
      // JSON inválido → mantém {} (todos os dias sem mínimo)
    }
  }
  const clamp = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(12, Math.floor(n))
  }
  return {
    seg: clamp(parsed.seg),
    ter: clamp(parsed.ter),
    qua: clamp(parsed.qua),
    qui: clamp(parsed.qui),
    sex: clamp(parsed.sex),
    sab: clamp(parsed.sab),
    dom: clamp(parsed.dom),
  }
}

/**
 * AdminSettingsService — gerencia configurações globais (slots de entrega/cutoff + avulso).
 *
 * Config global de slots é a fonte da verdade dos horários de corte (um por slot);
 * ao salvar, é propagada para todos os condomínios (ver lib/delivery-slots).
 * Push processCutoff é best-effort — falha silenciosa.
 */

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

export class AdminSettingsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Slots de entrega: o PADRÃO global, ou os slots EFETIVOS de um condomínio.
   *
   * No escopo de condomínio as flags `timeCustom`/`activeCustom` vêm preenchidas, dizendo o que
   * é personalizado e o que é herdado; no escopo global elas simplesmente não existem.
   */
  async getDeliverySlots(condominiumId?: string | null): Promise<DeliverySlotView[]> {
    return condominiumId
      ? getCondoDeliverySlots(this.prisma, condominiumId)
      : getGlobalDeliverySlots(this.prisma)
  }

  /**
   * Aplica edições nos slots. Sem `condominiumId`, edita o PADRÃO global (time, cutoffTime,
   * label, emoji, isActive) e propaga para os condomínios — preservando o que cada um
   * personalizou. Com `condominiumId`, personaliza só `time`/`isActive` daquele condomínio
   * (`null` volta a herdar); o corte permanece global.
   */
  async setDeliverySlots(
    patches: SlotPatch[] | CondoSlotPatch[],
    condominiumId?: string | null,
  ): Promise<DeliverySlotView[]> {
    return condominiumId
      ? setCondoDeliverySlots(this.prisma, condominiumId, patches as CondoSlotPatch[])
      : setGlobalDeliverySlots(this.prisma, patches as SlotPatch[])
  }

  /**
   * Retorna a configuração de compra avulsa.
   * limit: quantidade máxima por pedido avulso
   * unitPrice: preço por unidade avulsa
   */
  async getAvulsoConfig(): Promise<{ limit: number; unitPrice: number }> {
    const [limiteRow, unitRow] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: 'avulsoLimite' } }),
      this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } }),
    ])

    return {
      limit: limiteRow ? parseInt(limiteRow.value, 10) : 0,
      unitPrice: unitRow ? parseFloat(unitRow.value) : 0,
    }
  }

  /**
   * Atualiza (upsert) as configurações de compra avulsa.
   */
  async setAvulsoConfig(limit: number, unitPrice: number): Promise<void> {
    await Promise.all([
      this.prisma.setting.upsert({
        where: { key: 'avulsoLimite' },
        create: { key: 'avulsoLimite', value: String(limit) },
        update: { value: String(limit) },
      }),
      this.prisma.setting.upsert({
        where: { key: 'avulsoUnit' },
        create: { key: 'avulsoUnit', value: String(unitPrice) },
        update: { value: String(unitPrice) },
      }),
    ])
  }

  /**
   * Retorna os pedidos mínimos configurados:
   * - `unico`: mínimo do pedido único (default 1).
   * - `agenda`: mínimo por dia da semana (default 0 por dia). Aplica-se por turno.
   *
   * Faz parse defensivo do JSON de agenda: chave ausente/malformada → 0 no dia (não quebra).
   */
  async getPedidoMinimoConfig(): Promise<{ unico: number; agenda: WeekdayMinimums }> {
    const [unicoRow, agendaRow] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: 'pedidoMinimoUnico' } }),
      this.prisma.setting.findUnique({ where: { key: 'pedidoMinimoAgenda' } }),
    ])

    const unicoParsed = unicoRow ? parseInt(unicoRow.value, 10) : 1
    const unico = Number.isFinite(unicoParsed) && unicoParsed >= 1 ? unicoParsed : 1

    return { unico, agenda: parseAgendaMinimos(agendaRow?.value) }
  }

  /**
   * Atualiza (upsert) os pedidos mínimos (pedido único + agenda por dia).
   */
  async setPedidoMinimoConfig(unico: number, agenda: WeekdayMinimums): Promise<void> {
    await Promise.all([
      this.prisma.setting.upsert({
        where: { key: 'pedidoMinimoUnico' },
        create: { key: 'pedidoMinimoUnico', value: String(unico) },
        update: { value: String(unico) },
      }),
      this.prisma.setting.upsert({
        where: { key: 'pedidoMinimoAgenda' },
        create: { key: 'pedidoMinimoAgenda', value: JSON.stringify(agenda) },
        update: { value: JSON.stringify(agenda) },
      }),
    ])
  }

  /**
   * Retorna a config do gancho de porta:
   * - `pedidoUnicoMin`: mínimo de pães num pedido único para ganhar o gancho grátis.
   * - `preco`: preço de um gancho adicional (reposição), cobrado via Pix.
   */
  async getGanchoConfig(): Promise<GanchoConfig> {
    return getGanchoConfig(this.prisma)
  }

  /**
   * Atualiza (upsert) a config do gancho de porta (mínimo do pedido único + preço).
   */
  async setGanchoConfig(pedidoUnicoMin: number, preco: number): Promise<void> {
    await Promise.all([
      this.prisma.setting.upsert({
        where: { key: 'ganchoPedidoUnicoMin' },
        create: { key: 'ganchoPedidoUnicoMin', value: String(pedidoUnicoMin) },
        update: { value: String(pedidoUnicoMin) },
      }),
      this.prisma.setting.upsert({
        where: { key: 'ganchoPreco' },
        create: { key: 'ganchoPreco', value: String(preco) },
        update: { value: String(preco) },
      }),
    ])
  }

  /**
   * Restrições por dia da semana RESOLVIDAS: o padrão global, ou o efetivo de um condomínio
   * (override ?? global) junto com `source`, que diz por seção se veio do condomínio ou do padrão.
   */
  async getRestricoes(condominiumId?: string | null): Promise<ResolvedRules> {
    return getRulesForCondo(this.prisma, condominiumId)
  }

  /**
   * Atualiza as restrições por dia da semana.
   *
   * Sem `condominiumId` grava o PADRÃO global (Setting) — vale para todo condomínio que não
   * personalizou. Com `condominiumId` grava o override daquele condomínio, e `null` em qualquer
   * um dos dois mapas significa "voltar a herdar o padrão".
   *
   * Nos dois casos, dias que passaram de liberado → bloqueado disparam aviso (best-effort) aos
   * clientes com agenda ativa naquele dia. Não cancela pedidos já materializados — para isso
   * existe o bloqueio de DATA com `cancelExisting` (ver AdminBlocksService).
   */
  async setRestricoes(
    diasBloqueados: DiasBloqueados | null,
    limitePedidosDia: LimitePedidosDia | null,
    condominiumId?: string | null,
  ): Promise<ResolvedRules> {
    const before = await getRulesForCondo(this.prisma, condominiumId)

    if (condominiumId) {
      const exists = await this.prisma.condominium.findUnique({
        where: { id: condominiumId },
        select: { id: true },
      })
      if (!exists) throw { statusCode: 404, message: 'Condomínio não encontrado' }

      // `null` = herdar. No Mongo, gravar null é diferente de não ter a chave; a resolução trata
      // os dois como herança (ver resolveCondoRules), então null explícito é seguro e simples.
      await this.prisma.condominium.update({
        where: { id: condominiumId },
        data: {
          blockedDaysOverride: diasBloqueados ?? null,
          dayLimitOverride: limitePedidosDia ?? null,
        },
      })
    } else {
      await Promise.all([
        this.prisma.setting.upsert({
          where: { key: 'diasBloqueados' },
          create: { key: 'diasBloqueados', value: JSON.stringify(diasBloqueados) },
          update: { value: JSON.stringify(diasBloqueados) },
        }),
        this.prisma.setting.upsert({
          where: { key: 'limitePedidosDia' },
          create: { key: 'limitePedidosDia', value: JSON.stringify(limitePedidosDia) },
          update: { value: JSON.stringify(limitePedidosDia) },
        }),
      ])
    }

    const after = await getRulesForCondo(this.prisma, condominiumId)

    // Dias que passaram de liberado → bloqueado nesta edição (no escopo editado).
    const newlyBlocked = WEEKDAY_ORDER.filter((d) => !before.blocked[d] && after.blocked[d])
    if (newlyBlocked.length > 0) {
      try {
        await this.notifyNewlyBlockedDays(newlyBlocked, condominiumId)
      } catch (err) {
        this.fastify.log.warn({ err }, '[admin-settings] falha ao avisar clientes de dias bloqueados — ignorado')
      }
    }

    return after
  }

  /**
   * Notifica (in-app + push best-effort) clientes com agenda ativa que entrega em algum dos
   * `days` recém-bloqueados, pedindo para reconfigurarem. Um aviso por cliente afetado.
   * Não cancela pedidos já materializados — o corte simplesmente para de gerar nesses dias.
   *
   * Com `condominiumId`, avisa só os clientes daquele condomínio (a mudança foi local).
   */
  private async notifyNewlyBlockedDays(
    days: Array<keyof DiasBloqueados>,
    condominiumId?: string | null,
  ): Promise<void> {
    const schedules = await this.prisma.schedule.findMany({
      where: { isActive: true, ...(condominiumId ? { condominiumId } : {}) },
      select: { userId: true, days: true, weeklyQty: true, pausedAt: true },
    })

    const affected = new Set<string>()
    for (const s of schedules) {
      const buckets: Array<Record<string, unknown>> = []
      if (s.days && typeof s.days === 'object') {
        buckets.push(...(Object.values(s.days as Record<string, Record<string, unknown>>)))
      }
      if (s.weeklyQty && typeof s.weeklyQty === 'object') {
        buckets.push(s.weeklyQty as Record<string, unknown>)
      }
      const hit = buckets.some(
        (wq) => wq && days.some((d) => Number((wq as Record<string, unknown>)[d] ?? 0) > 0),
      )
      if (hit) affected.add(s.userId)
    }

    if (affected.size === 0) return

    const labels = days.map((d) => WEEKDAY_LABEL[d]).join(', ')
    const plural = days.length > 1
    const body = `Não haverá mais entregas ${plural ? 'nos dias' : 'no dia'}: ${labels}. Atualize sua agenda semanal.`
    const notifications = new NotificationsService(this.fastify)

    for (const userId of affected) {
      try {
        await notifications.notifyUser(userId, {
          type: NotificationType.RECONFIGURE,
          title: 'Ajuste sua agenda',
          body,
          actionRoute: '/client/agenda',
        })
      } catch (err) {
        this.fastify.log.warn({ userId, err }, '[admin-settings] falha ao notificar cliente de dia bloqueado')
      }
    }

    this.fastify.log.info(
      `[admin-settings] ${affected.size} cliente(s) avisado(s) de dia(s) recém-bloqueado(s): ${labels}`,
    )
  }

  /**
   * Status de corte POR SLOT do condomínio do cliente, pela PRÓXIMA ocorrência de entrega.
   * `locked`: o corte da próxima entrega daquele slot já passou (não dá mais p/ pedir nela).
   *   - manhã (06:30/corte 22:00): fica locked das 22:00 até a entrega 06:30 do dia seguinte.
   *   - tarde (15:30/corte 10:00): fica locked das 10:00 até a entrega 15:30 do mesmo dia.
   * `deliveryWhen`: "hoje" | "amanhã" — quando é a próxima entrega desse slot.
   */
  async getCutoffStatusByCondo(condominiumId: string): Promise<{
    slots: Array<{
      slotId: string
      name: string
      label: string
      emoji: string
      time: string
      cutoffTime: string
      locked: boolean
      deliveryWhen: string
    }>
  }> {
    const condo = await this.prisma.condominium.findUnique({
      where: { id: condominiumId },
      select: { deliverySlots: true },
    })
    const now = new Date()
    const today = brtDateStr(now, 0)
    const tomorrow = brtDateStr(now, 1)
    const slots = (condo?.deliverySlots ?? [])
      .filter((s) => s.isActive)
      .map((raw) => {
        const s = normalizeSlot(raw)
        const deliveryStr = nextDeliveryDateStr(s.time, now)
        const locked = isPastCutoffForDelivery(s.time, s.cutoffTime, deliveryStr, now)
        const deliveryWhen = deliveryStr === today ? 'hoje' : deliveryStr === tomorrow ? 'amanhã' : deliveryStr
        return {
          slotId: s.slotId,
          name: s.name,
          label: s.label,
          emoji: s.emoji,
          time: s.time,
          cutoffTime: s.cutoffTime,
          locked,
          deliveryWhen,
        }
      })
    return { slots }
  }

  /**
   * Verifica se o horário atual (BRT) corresponde ao horário de corte de algum slot
   * em algum condomínio ativo. Itera por condomínio e por slot — multi-slot.
   *
   * Para cada par (condomínio, slot) em corte:
   *   - Notifica clientes do condomínio que não têm Order para amanhã.
   *
   * Push é best-effort — falhas são logadas como warn e não interrompem o fluxo.
   * Chamado pelo cron job a cada hora cheia (cron.ts).
   */
  async processCutoff(): Promise<void> {
    // Hora atual no fuso de Brasília — formato HH:MM (24h)
    const nowHHMM = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())

    // Busca todos os condomínios ativos com seus slots
    const condominiums = await this.prisma.condominium.findMany({
      where: { isActive: true },
    })

    // Filtra pares (condomínio, slot) cujo cutoffTime corresponde ao horário atual
    const cutoffPairs: Array<{ condoId: string; condoName: string; slotName: string }> = []
    for (const condo of condominiums) {
      for (const slot of condo.deliverySlots) {
        if (slot.isActive && slot.cutoffTime === nowHHMM) {
          cutoffPairs.push({ condoId: condo.id, condoName: condo.name, slotName: slot.name })
        }
      }
    }

    if (cutoffPairs.length === 0) {
      return
    }

    this.fastify.log.info(
      `[admin-settings] processCutoff: ${cutoffPairs.length} par(es) condomínio/slot em corte no horário ${nowHHMM}`,
    )

    // Calcula o intervalo de amanhã em BRT (início / fim do dia)
    const now = new Date()
    const tomorrowStart = new Date(
      new Date(now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })).getTime() +
        24 * 60 * 60 * 1000,
    )
    // Ajuste para BRT (UTC-3)
    const tomorrowStartBrt = new Date(tomorrowStart.getTime() + 3 * 60 * 60 * 1000)
    const tomorrowEndBrt = new Date(tomorrowStartBrt.getTime() + 24 * 60 * 60 * 1000 - 1)

    const osClient = createOsClient()
    let totalNotified = 0

    for (const pair of cutoffPairs) {
      // Busca clientes do condomínio com oneSignalPlayerId — batched por condomínio (não O(N²))
      const clients = await this.prisma.user.findMany({
        where: {
          role: 'CLIENT',
          condominiumId: pair.condoId,
          oneSignalPlayerId: { not: null },
          isBlocked: false,
        },
        select: { id: true, oneSignalPlayerId: true },
      })

      if (clients.length === 0) continue

      // Busca Orders de amanhã para este condomínio — filtra quem JÁ tem pedido
      const tomorrowOrders = await this.prisma.order.findMany({
        where: {
          condominiumId: pair.condoId,
          scheduledDate: {
            gte: tomorrowStartBrt,
            lte: tomorrowEndBrt,
          },
          status: { not: 'CANCELLED' },
        },
        select: { userId: true },
      })

      const usersWithOrderTomorrow = new Set(tomorrowOrders.map((o: { userId: string }) => o.userId))

      // Filtra clientes sem pedido para amanhã
      const clientsToNotify = clients.filter(
        (c: { id: string; oneSignalPlayerId: string | null }) =>
          !usersWithOrderTomorrow.has(c.id) && c.oneSignalPlayerId,
      )

      if (clientsToNotify.length === 0) {
        this.fastify.log.info(
          `[admin-settings] processCutoff: todos os clientes do condomínio ${pair.condoName} (slot ${pair.slotName}) já têm pedido para amanhã`,
        )
        continue
      }

      // Mensagem específica por slot
      const pushContents =
        pair.slotName === 'tarde'
          ? 'Prazo de pãezinhos da tarde de amanhã encerrando!'
          : 'Prazo de pãezinhos da manhã de amanhã encerrando!'

      // Envia push — best-effort
      for (const client of clientsToNotify) {
        try {
          const notification = new OneSignal.Notification()
          notification.app_id = process.env.ONESIGNAL_APP_ID!
          notification.include_subscription_ids = [client.oneSignalPlayerId!]
          notification.headings = { pt: 'Cheirin de Pão' }
          notification.contents = { pt: pushContents }
          await osClient.createNotification(notification)
          totalNotified++
        } catch (pushErr) {
          this.fastify.log.warn(
            { err: pushErr },
            `[admin-settings] falha ao enviar push para ${client.id} (slot ${pair.slotName}) — ignorado`,
          )
        }
      }
    }

    this.fastify.log.info(
      `[admin-settings] processCutoff: ${totalNotified} notificação(ões) enviada(s) no horário ${nowHHMM}`,
    )
  }
}
