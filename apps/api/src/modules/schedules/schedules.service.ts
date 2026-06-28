import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { SchedulesRepository } from './schedules.repository.js'
import { ScheduleBody, WeeklyQty } from './schedules.schema.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import {
  nowHHMM,
  targetDeliveryDate,
  dayKeyOf,
  brtDayRange,
  brtDateStr,
  brtNoonFromStr,
  isPastCutoffForDelivery,
  nextDeliveryDateStr,
  cutoffInstantForDelivery,
  type DayKey,
} from '../../lib/cutoff.js'

/** Teto de tentativas de cobrança auto-recarga por (user, slot, dia) — anti-spam de cartão. */
const MAX_RECHARGE_ATTEMPTS = 3

// D-09: Helper puro que calcula consumo semanal total independente de modo (multi-slot ou legado)
function getConsumoSemanal(schedule: { days: unknown; weeklyQty: unknown }): number {
  if (schedule.days) {
    const days = schedule.days as Record<string, WeeklyQty>
    return Object.values(days)
      .flatMap((wq) => Object.values(wq))
      .reduce((sum, v) => sum + (v as number), 0)
  }
  const wq = schedule.weeklyQty as WeeklyQty
  return Object.values(wq).reduce((sum, v) => sum + (v as number), 0)
}

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

export class SchedulesService {
  private repo: SchedulesRepository
  private notificationsService: NotificationsService
  private payments: PaymentsService

  // Anti-spam de cobrança na janela T-2h: nº de cobranças por `${user}|${slot}|${dia}`.
  // Em memória (compartilhado entre ticks; instância única em cron.ts) — resetar no restart só
  // permite no máx. +MAX_RECHARGE_ATTEMPTS cobranças, aceitável. O marcador de CICLO materializado
  // (backfill 1x) é PERSISTIDO no banco (MaterializedCycle) — sobrevive a restart e à meia-noite.
  private autoRechargeAttempts = new Map<string, number>()

  constructor(private fastify: FastifyInstance) {
    this.repo = new SchedulesRepository(fastify)
    this.notificationsService = new NotificationsService(fastify)
    this.payments = new PaymentsService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  async upsertSchedule(userId: string, condominiumId: string, data: ScheduleBody) {
    return this.repo.upsert(userId, condominiumId, data)
  }

  async getSchedule(userId: string) {
    const schedule = await this.repo.findActiveByUserId(userId)
    return schedule ?? null
  }

  /**
   * Cria as orders de UM slot de UM condomínio para a `deliveryDate` informada.
   * Idempotente: pula se já existe Order para (user, slot, dia) — seguro p/ cron por minuto.
   * Preenche `condominiumId` + `deliveryTime` e debita créditos (transação por order).
   *
   * @param opts.onlyAutoRecharge só processa clientes com recarga automática ativa (pré-confirmação T-2h).
   * @param opts.rechargeAttempts mapa compartilhado de tentativas `${user}|${slot}|${dia}` → nº; com
   *   `maxRechargeAttempts`, limita re-cobranças no modo janela (anti-spam de cartão). Sem ele = ilimitado.
   * @param opts.maxRechargeAttempts teto de tentativas de cobrança por (user, slot, dia).
   * @param opts.suppressInsufficientPush não envia o push "sem saldo" (a janela suprime; o corte avisa 1x).
   */
  async createOrdersForCondoSlot(
    condominiumId: string,
    slot: { slotId: string; time: string },
    dayKey: DayKey,
    deliveryDate: Date,
    opts: {
      onlyAutoRecharge?: boolean
      rechargeAttempts?: Map<string, number>
      maxRechargeAttempts?: number
      suppressInsufficientPush?: boolean
    } = {},
  ): Promise<void> {
    const schedules = await this.prisma.schedule.findMany({
      where: { condominiumId, isActive: true },
    })
    const { start, end } = brtDayRange(deliveryDate)
    const dateLabel = deliveryDate.toISOString().split('T')[0]

    for (const schedule of schedules) {
      try {
        // Quantidade deste slot para o dia da semana alvo — agenda indexada por slotId.
        const days = (schedule.days as Record<string, WeeklyQty> | null) ?? {}
        const qty = days[slot.slotId]?.[dayKey] ?? 0
        if (qty === 0) continue

        // Idempotência — não duplica se o cron reexecutar no mesmo minuto/dia (por slotId)
        const existing = await this.prisma.order.findFirst({
          where: {
            userId: schedule.userId,
            slotId: slot.slotId,
            type: 'SCHEDULED',
            status: { not: 'CANCELLED' },
            scheduledDate: { gte: start, lte: end },
          },
          select: { id: true },
        })
        if (existing) continue

        const user = await this.repo.findUserById(schedule.userId)
        if (!user) continue

        // Pré-confirmação T-2h: processa SÓ quem tem recarga automática ativa.
        // Os demais (recarga manual/avulso) seguem sendo materializados no corte.
        if (opts.onlyAutoRecharge) {
          const ar = user.autoRecharge as { active?: boolean } | null
          if (!ar?.active) continue
        }

        let balance = user.creditBalance

        // Saldo insuficiente: tenta a recarga automática (sem CVV).
        // chargeAutoRecharge é self-validating (só cobra se ativa + consentida + cartão padrão).
        // Com rechargeAttempts+max, limita re-cobranças (anti-spam de cartão no modo janela).
        if (balance < qty) {
          const attemptKey = `${schedule.userId}|${slot.slotId}|${dateLabel}`
          const tracker = opts.rechargeAttempts
          const tried = tracker?.get(attemptKey) ?? 0
          const max = opts.maxRechargeAttempts ?? Number.POSITIVE_INFINITY
          if (tried < max) {
            if (tracker) tracker.set(attemptKey, tried + 1)
            const result = await this.payments.chargeAutoRecharge(schedule.userId)
            if (result.ok) {
              const refreshed = await this.repo.findUserById(schedule.userId)
              balance = refreshed?.creditBalance ?? balance
            }
          }
        }

        // Ainda insuficiente (recarga inativa/recusada): NÃO cria a order + avisa (1x — no corte).
        if (balance < qty) {
          if (!opts.suppressInsufficientPush && user.oneSignalPlayerId) {
            try {
              const osClient = createOsClient()
              const notification = new OneSignal.Notification()
              notification.app_id = process.env.ONESIGNAL_APP_ID!
              notification.include_subscription_ids = [user.oneSignalPlayerId]
              notification.headings = { pt: 'Cheirin de Pão' }
              notification.contents = {
                pt: 'Por falta de saldo não foi possível gerar seu pedido agendado. Recarregue seus créditos.',
              }
              notification.url = '/client/creditos'
              await osClient.createNotification(notification)
            } catch (pushErr) {
              this.fastify.log.warn(
                { userId: schedule.userId, err: pushErr },
                '[schedules] falha push crédito insuficiente (corte)',
              )
            }
          }
          continue
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              userId: schedule.userId,
              type: 'SCHEDULED',
              quantity: qty,
              scheduledDate: deliveryDate,
              status: 'SCHEDULED',
              slotId: slot.slotId,
              deliveryTime: slot.time,
              condominiumId,
            },
          })
          await tx.user.update({
            where: { id: schedule.userId },
            data: { creditBalance: { decrement: qty } },
          })
          await tx.creditTransaction.create({
            data: {
              userId: schedule.userId,
              type: 'DELIVERY',
              quantity: -qty,
              description: `Entrega agendada para ${dateLabel} às ${slot.time}`,
            },
          })
        })
      } catch (err) {
        this.fastify.log.error(
          { scheduleId: schedule.id, err },
          '[schedules] erro ao criar order no corte',
        )
      }
    }
  }

  /**
   * Materializa os pedidos de UM turno (slot) em TODOS os condomínios ativos, para a
   * data de entrega informada. Usado pelo "Encerrar corte" manual da aba Compra para
   * fechar o ciclo daquele turno — sem tocar nos outros turnos (pipeline por slot).
   *
   * Idempotente: createOrdersForCondoSlot pula pedidos já existentes — seguro mesmo
   * que o cron já tenha materializado o turno (ou o admin clique mais de uma vez).
   */
  async materializeOrdersForSlot(deliveryDate: Date, slotId: string): Promise<void> {
    const dayKey = dayKeyOf(deliveryDate)
    const condominiums = await this.prisma.condominium.findMany({ where: { isActive: true } })
    for (const condo of condominiums) {
      const slot = condo.deliverySlots.find((s) => (s.slotId ?? s.name) === slotId && s.isActive)
      if (!slot) continue
      await this.createOrdersForCondoSlot(condo.id, { slotId, time: slot.time }, dayKey, deliveryDate)
    }
  }

  /**
   * Disparado pelo cron a cada minuto: para cada (condomínio ativo, slot ativo) cujo
   * `cutoffTime` casa com a hora BRT atual, cria as orders da data alvo (Regra A).
   * Substitui a criação à meia-noite — agora a order é "fechada" no corte de cada slot.
   * Marca o ciclo como materializado (materializedCycles) p/ o backfill não reprocessar.
   */
  async createOrdersAtCutoff(now: Date = new Date()): Promise<void> {
    const hhmm = nowHHMM(now)
    const condominiums = await this.prisma.condominium.findMany({ where: { isActive: true } })

    for (const condo of condominiums) {
      for (const slot of condo.deliverySlots) {
        if (!slot.isActive || slot.cutoffTime !== hhmm) continue
        const slotId = slot.slotId ?? slot.name
        const deliveryDate = targetDeliveryDate(slot.time, slot.cutoffTime, now)
        const dayKey = dayKeyOf(deliveryDate)
        this.fastify.log.info(
          `[schedules] corte ${hhmm} — ${condo.name} / slot ${slot.name} (${slot.time}) → gerando orders p/ ${deliveryDate.toISOString().split('T')[0]}`,
        )
        await this.createOrdersForCondoSlot(condo.id, { slotId, time: slot.time }, dayKey, deliveryDate, {
          rechargeAttempts: this.autoRechargeAttempts,
          maxRechargeAttempts: MAX_RECHARGE_ATTEMPTS,
        })
        await this.repo.markCycleMaterialized(condo.id, slotId, deliveryDate.toISOString().slice(0, 10))
      }
    }
  }

  /** Limpa o anti-spam de cobrança (em memória) de dias passados — chamado a cada minuto. */
  private pruneCronState(now: Date): void {
    const today = brtDateStr(now, 0)
    for (const k of this.autoRechargeAttempts.keys()) {
      if (k.slice(k.lastIndexOf('|') + 1) < today) this.autoRechargeAttempts.delete(k)
    }
  }

  /** Remove marcas de ciclos materializados antigos (entrega < hoje-2). Chamado no cron diário. */
  async cleanupOldMaterializedCycles(now: Date = new Date()): Promise<void> {
    await this.repo.deleteCyclesBefore(brtDateStr(now, -2))
  }

  /**
   * backfillMissedCutoffs — disparado pelo cron a cada minuto. Para cada slot, examina as entregas
   * de HOJE e AMANHÃ (BRT) cujo corte (instante ABSOLUTO) já passou mas que ainda NÃO foram
   * materializadas (marca persistida em MaterializedCycle) — ex.: servidor fora do ar no minuto
   * exato do corte (node-cron não faz backfill). Materializa agora, 1x por ciclo.
   *
   * Por usar datas absolutas + marca persistida, recupera cortes mesmo CRUZANDO A MEIA-NOITE e
   * SOBREVIVE A RESTART. Idempotente; cobrança limitada (anti-spam).
   */
  async backfillMissedCutoffs(now: Date = new Date()): Promise<void> {
    const candidates = [brtDateStr(now, 0), brtDateStr(now, 1)]
    const condominiums = await this.prisma.condominium.findMany({ where: { isActive: true } })

    for (const condo of condominiums) {
      for (const slot of condo.deliverySlots) {
        if (!slot.isActive) continue
        const slotId = slot.slotId ?? slot.name
        for (const deliveryStr of candidates) {
          // Só recupera cortes cujo instante absoluto já passou.
          if (!isPastCutoffForDelivery(slot.time, slot.cutoffTime, deliveryStr, now)) continue
          if (await this.repo.isCycleMaterialized(condo.id, slotId, deliveryStr)) continue

          const deliveryDate = brtNoonFromStr(deliveryStr)
          const dayKey = dayKeyOf(deliveryDate)
          this.fastify.log.warn(
            `[schedules] BACKFILL corte perdido — ${condo.name} / slot ${slot.name} (corte ${slot.cutoffTime}) → ${deliveryStr}`,
          )
          await this.createOrdersForCondoSlot(condo.id, { slotId, time: slot.time }, dayKey, deliveryDate, {
            rechargeAttempts: this.autoRechargeAttempts,
            maxRechargeAttempts: MAX_RECHARGE_ATTEMPTS,
          })
          await this.repo.markCycleMaterialized(condo.id, slotId, deliveryStr)
        }
      }
    }
  }

  /**
   * preconfirmAutoRechargeAhead — disparado pelo cron a cada minuto. `leadMinutes` antes do
   * corte de cada slot, confirma ANTECIPADAMENTE as orders de quem tem recarga automática ativa:
   * cobra o cartão off-session e cria a order, dando margem para a cobrança processar antes do
   * corte (evita que uma demora deixe o agendado sem confirmar quando a auto-recarga está ativa).
   *
   * Só toca em clientes com auto-recarga ativa — os demais seguem sendo materializados no corte.
   * Roda em JANELA `[corte − leadMinutes, corte)` usando o INSTANTE ABSOLUTO do corte (seguro p/
   * janelas que cruzam a meia-noite): a cada minuto tenta confirmar quem ainda falta, com no máx.
   * MAX_RECHARGE_ATTEMPTS cobranças por (user, slot, dia) — retenta falhas transitórias sem
   * martelar o cartão (anti-spam). Suprime o push "sem saldo" na janela (o corte avisa 1x).
   * Quem é confirmado vira Order e é pulado por idempotência nos minutos seguintes.
   */
  async preconfirmAutoRechargeAhead(now: Date = new Date(), leadMinutes = 120): Promise<void> {
    this.pruneCronState(now)
    const leadMs = leadMinutes * 60_000
    const condominiums = await this.prisma.condominium.findMany({ where: { isActive: true } })

    for (const condo of condominiums) {
      for (const slot of condo.deliverySlots) {
        if (!slot.isActive) continue
        const deliveryStr = nextDeliveryDateStr(slot.time, now) // próxima entrega deste slot
        const cutoffAt = cutoffInstantForDelivery(slot.time, slot.cutoffTime, deliveryStr).getTime()
        // Janela [corte − lead, corte): instantes absolutos, robusto à meia-noite.
        if (now.getTime() < cutoffAt - leadMs || now.getTime() >= cutoffAt) continue

        const slotId = slot.slotId ?? slot.name
        const deliveryDate = brtNoonFromStr(deliveryStr)
        const dayKey = dayKeyOf(deliveryDate)
        await this.createOrdersForCondoSlot(condo.id, { slotId, time: slot.time }, dayKey, deliveryDate, {
          onlyAutoRecharge: true,
          rechargeAttempts: this.autoRechargeAttempts,
          maxRechargeAttempts: MAX_RECHARGE_ATTEMPTS,
          suppressInsufficientPush: true,
        })
      }
    }
  }

  async sendReconfigureReminders() {
    const schedules = await this.prisma.schedule.findMany({
      where: { notifyReconfigure: true, isActive: true },
    })

    const playerIds: string[] = []
    for (const schedule of schedules) {
      const user = await this.repo.findUserById(schedule.userId)
      if (user?.oneSignalPlayerId) {
        playerIds.push(user.oneSignalPlayerId)
      }
    }

    if (playerIds.length === 0) {
      this.fastify.log.info('[schedules] sendReconfigureReminders: nenhum player_id encontrado')
      return
    }

    try {
      const osClient = createOsClient()
      const notification = new OneSignal.Notification()
      notification.app_id = process.env.ONESIGNAL_APP_ID!
      notification.include_subscription_ids = playerIds
      notification.headings = { pt: 'Ajuste sua agenda para a semana' }
      notification.contents = { pt: 'Toque para revisar e atualizar sua agenda de entregas.' }
      notification.url = '/client/agenda'
      await osClient.createNotification(notification)
    } catch (err) {
      this.fastify.log.error({ err }, '[schedules] erro ao enviar push de reconfiguração')
    }
  }

  async sendEveReminders() {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const day = now.getUTCDate()
    const BRAZIL_OFFSET_HOURS = 3

    // Amanhã em BRT: começa às UTC+3h do dia seguinte, termina às UTC+3h-1ms do dia subsequente
    const tomorrowStart = new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS, 0, 0, 0))
    const tomorrowEnd = new Date(Date.UTC(year, month, day + 2, BRAZIL_OFFSET_HOURS - 1, 59, 59, 999))

    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { not: 'CANCELLED' },
      },
    })

    for (const order of orders) {
      const user = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { oneSignalPlayerId: true },
      })

      if (user?.oneSignalPlayerId) {
        try {
          const osClient = createOsClient()
          const notification = new OneSignal.Notification()
          notification.app_id = process.env.ONESIGNAL_APP_ID!
          notification.include_subscription_ids = [user.oneSignalPlayerId]
          notification.headings = { pt: 'Entrega amanhã 🥖' }
          // D-10: incluir horário no texto quando disponível; nunca interpolar null (T-14-03-03)
          const timeStr = order.deliveryTime ? ` às ${order.deliveryTime}` : ''
          notification.contents = { pt: `Lembrete: ${order.quantity} pães${timeStr} amanhã.` }
          notification.data = { screen: 'pedidos' }
          await osClient.createNotification(notification)
        } catch (pushErr) {
          // D-06: falha de push é silenciosa — Notification ainda é persistida
          this.fastify.log.warn(
            { userId: order.userId, err: pushErr },
            '[schedules] falha ao enviar push de véspera — silencioso (D-06)',
          )
        }
      }

      const timeStr = order.deliveryTime ? ` às ${order.deliveryTime}` : ''
      await this.notificationsService.createAndTrim({
        userId: order.userId,
        type: 'DELIVERY_EVE',
        title: 'Entrega amanhã 🥖',
        body: `Lembrete: ${order.quantity} pães${timeStr} amanhã.`,
        actionRoute: '/client/pedidos',
      })
    }
  }

  /**
   * DESCONTINUADO. A recarga automática agora é JUST-IN-TIME no corte
   * (createOrdersForCondoSlot cobra o cartão padrão sem CVV via Stripe no momento da order).
   * O antigo fluxo (push para finalizar / modo "semanal") foi removido e não é mais agendado.
   * Mantido como no-op para não quebrar chamadas legadas.
   */
  async processAutoBuy(): Promise<void> {
    return
  }

  // CRED-09: Notifica clientes sem auto-recharge quando o saldo está abaixo do consumo semanal.
  // Chamado no cron de meia-noite após processAutoBuy (D-10).
  async sendLowCreditNotifications(): Promise<void> {
    const schedules = await this.prisma.schedule.findMany({
      where: { isActive: true },
    })

    for (const schedule of schedules) {
      try {
        const user = await this.repo.findUserById(schedule.userId)
        if (!user) continue

        // Usuários com auto-recharge ativo não precisam da notificação (D-10)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const autoRecharge = user.autoRecharge as any
        if (autoRecharge?.active) continue

        // D-09: usar getConsumoSemanal para suportar multi-slot e legado
        const consumoSemanal = getConsumoSemanal(schedule)
        if (consumoSemanal === 0) continue
        if (user.creditBalance >= consumoSemanal) continue

        // Enviar push de crédito insuficiente (D-11 — deep link via url)
        if (user.oneSignalPlayerId) {
          try {
            const osClient = createOsClient()
            const notification = new OneSignal.Notification()
            notification.app_id = process.env.ONESIGNAL_APP_ID!
            notification.include_subscription_ids = [user.oneSignalPlayerId]
            notification.headings = { pt: 'Seus créditos estão acabando' }
            notification.contents = {
              pt: `Você tem ${user.creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}. Recarregue agora antes que faltem pães!`,
            }
            notification.url = '/client/creditos'
            await osClient.createNotification(notification)
          } catch (pushErr) {
            this.fastify.log.warn(
              { userId: schedule.userId, err: pushErr },
              '[schedules] falha ao enviar push de crédito insuficiente — silencioso',
            )
          }
        }

        // Persistir Notification LOW_CREDIT independente de oneSignalPlayerId (padrão de sendEveReminders)
        await this.notificationsService.createAndTrim({
          userId: schedule.userId,
          type: 'LOW_CREDIT',
          title: 'Créditos insuficientes',
          body: `Você tem ${user.creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}.`,
        })
      } catch (err) {
        this.fastify.log.error(
          { scheduleId: schedule.id, err },
          '[schedules] erro ao processar sendLowCreditNotifications',
        )
      }
    }
  }
}
