import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { SchedulesRepository } from './schedules.repository.js'
import { ScheduleBody, WeeklyQty } from './schedules.schema.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import { nowHHMM, targetDeliveryDate, dayKeyOf, brtDayRange, type DayKey } from '../../lib/cutoff.js'

// Dia da semana em UTC-3 (Brasília) → chave do WeeklyQty
const DAY_OF_WEEK_MAP: Record<string, keyof WeeklyQty> = {
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
  Sun: 'dom',
}

function getTomorrowDayKey(): keyof WeeklyQty {
  // Calcular o dia de amanhã no timezone America/Sao_Paulo
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  })
  const weekday = formatter.format(tomorrow) // 'Mon', 'Tue', etc.
  return DAY_OF_WEEK_MAP[weekday] ?? 'seg'
}

function getTomorrowDate(): Date {
  const now = new Date()
  return new Date(now.getTime() + 24 * 60 * 60 * 1000)
}

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
   */
  async createOrdersForCondoSlot(
    condominiumId: string,
    slotTime: string,
    dayKey: DayKey,
    deliveryDate: Date,
  ): Promise<void> {
    const schedules = await this.prisma.schedule.findMany({
      where: { condominiumId, isActive: true },
    })
    const { start, end } = brtDayRange(deliveryDate)
    const dateLabel = deliveryDate.toISOString().split('T')[0]

    for (const schedule of schedules) {
      try {
        // Quantidade deste slot para o dia da semana alvo
        let qty = 0
        if (schedule.days) {
          const days = schedule.days as Record<string, WeeklyQty>
          qty = days[slotTime]?.[dayKey] ?? 0
        } else if (schedule.deliveryTime === slotTime) {
          // Legado: weeklyQty só conta para o slot cujo time bate com o deliveryTime salvo
          qty = (schedule.weeklyQty as WeeklyQty)?.[dayKey] ?? 0
        }
        if (qty === 0) continue

        // Idempotência — não duplica se o cron reexecutar no mesmo minuto/dia
        const existing = await this.prisma.order.findFirst({
          where: {
            userId: schedule.userId,
            deliveryTime: slotTime,
            type: 'SCHEDULED',
            status: { not: 'CANCELLED' },
            scheduledDate: { gte: start, lte: end },
          },
          select: { id: true },
        })
        if (existing) continue

        const user = await this.repo.findUserById(schedule.userId)
        if (!user) continue

        let balance = user.creditBalance

        // Saldo insuficiente: tenta a recarga automática (sem CVV) JUST-IN-TIME.
        // chargeAutoRecharge é self-validating (só cobra se ativa + consentida + cartão padrão).
        if (balance < qty) {
          const result = await this.payments.chargeAutoRecharge(schedule.userId)
          if (result.ok) {
            const refreshed = await this.repo.findUserById(schedule.userId)
            balance = refreshed?.creditBalance ?? balance
          }
        }

        // Ainda insuficiente (recarga inativa/recusada): NÃO cria a order + avisa.
        if (balance < qty) {
          if (user.oneSignalPlayerId) {
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
              deliveryTime: slotTime,
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
              description: `Entrega agendada para ${dateLabel} às ${slotTime}`,
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
   * Disparado pelo cron a cada minuto: para cada (condomínio ativo, slot ativo) cujo
   * `cutoffTime` casa com a hora BRT atual, cria as orders da data alvo (Regra A).
   * Substitui a criação à meia-noite — agora a order é "fechada" no corte de cada slot.
   */
  async createOrdersAtCutoff(now: Date = new Date()): Promise<void> {
    const hhmm = nowHHMM(now)
    const condominiums = await this.prisma.condominium.findMany({ where: { isActive: true } })

    for (const condo of condominiums) {
      for (const slot of condo.deliverySlots) {
        if (!slot.isActive || slot.cutoffTime !== hhmm) continue
        const deliveryDate = targetDeliveryDate(slot.time, slot.cutoffTime, now)
        const dayKey = dayKeyOf(deliveryDate)
        this.fastify.log.info(
          `[schedules] corte ${hhmm} — ${condo.name} / slot ${slot.name} (${slot.time}) → gerando orders p/ ${deliveryDate.toISOString().split('T')[0]}`,
        )
        await this.createOrdersForCondoSlot(condo.id, slot.time, dayKey, deliveryDate)
      }
    }
  }

  async createDailyOrders() {
    const schedules = await this.repo.findAllActive()
    const dayKey = getTomorrowDayKey()
    const scheduledDate = getTomorrowDate()

    for (const schedule of schedules) {
      try {
        // D-08: Detectar modo multi-slot via schedule.days
        if (schedule.days) {
          // MODO MULTI-SLOT: iterar por slot — transação independente por slot (T-14-03-02)
          const days = schedule.days as Record<string, WeeklyQty>
          for (const [slotTime, weeklyQtyMap] of Object.entries(days)) {
            const qty = weeklyQtyMap[dayKey] ?? 0
            if (qty === 0) continue

            // Busca fresh do usuário dentro de cada iteração de slot (saldo pode ter mudado após slot anterior)
            const user = await this.repo.findUserById(schedule.userId)
            if (!user) continue

            if (user.creditBalance < qty) {
              // Saldo insuficiente para este slot — enviar push de alerta e continuar para próximo slot
              if (user.oneSignalPlayerId) {
                try {
                  const osClient = createOsClient()
                  const notification = new OneSignal.Notification()
                  notification.app_id = process.env.ONESIGNAL_APP_ID!
                  notification.include_subscription_ids = [user.oneSignalPlayerId]
                  notification.headings = { pt: 'Cheirin de Pão' }
                  notification.contents = { pt: 'Créditos insuficientes para a entrega de amanhã' }
                  await osClient.createNotification(notification)
                } catch (pushErr) {
                  this.fastify.log.warn(
                    { userId: schedule.userId, err: pushErr },
                    '[schedules] falha ao enviar push de crédito insuficiente',
                  )
                }
              }
              continue
            }

            // Saldo suficiente — transação independente para este slot
            await this.prisma.$transaction(async (tx) => {
              await tx.order.create({
                data: {
                  userId: schedule.userId,
                  type: 'SCHEDULED',
                  quantity: qty,
                  scheduledDate,
                  status: 'SCHEDULED',
                  deliveryTime: slotTime,
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
                  description: `Entrega agendada para ${scheduledDate.toISOString().split('T')[0]} às ${slotTime}`,
                },
              })
            })
          }
          continue // pular o bloco legado abaixo
        }

        // MODO LEGADO: código original inalterado
        const weeklyQty = schedule.weeklyQty as WeeklyQty
        const qty = weeklyQty[dayKey] ?? 0

        if (qty === 0) {
          continue
        }

        const user = await this.repo.findUserById(schedule.userId)
        if (!user) continue

        if (user.creditBalance < qty) {
          // Saldo insuficiente — enviar push de alerta
          if (user.oneSignalPlayerId) {
            try {
              const osClient = createOsClient()
              const notification = new OneSignal.Notification()
              notification.app_id = process.env.ONESIGNAL_APP_ID!
              notification.include_subscription_ids = [user.oneSignalPlayerId]
              notification.headings = { pt: 'Cheirin de Pão' }
              notification.contents = { pt: 'Créditos insuficientes para a entrega de amanhã' }
              await osClient.createNotification(notification)
            } catch (pushErr) {
              this.fastify.log.warn(
                { userId: schedule.userId, err: pushErr },
                '[schedules] falha ao enviar push de crédito insuficiente',
              )
            }
          }
          continue
        }

        // Saldo suficiente — criar Order + decrementar creditBalance + CreditTransaction
        await this.prisma.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              userId: schedule.userId,
              type: 'SCHEDULED',
              quantity: qty,
              scheduledDate,
              status: 'SCHEDULED',
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
              description: `Entrega agendada para ${scheduledDate.toISOString().split('T')[0]}`,
            },
          })
        })
      } catch (err) {
        this.fastify.log.error(
          { scheduleId: schedule.id, err },
          '[schedules] erro ao processar schedule para criação de order',
        )
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
