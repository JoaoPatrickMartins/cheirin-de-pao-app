import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { SchedulesRepository } from './schedules.repository.js'
import { ScheduleBody, WeeklyQty } from './schedules.schema.js'
import { NotificationsService } from '../notifications/notifications.service.js'

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

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

export class SchedulesService {
  private repo: SchedulesRepository
  private notificationsService: NotificationsService

  constructor(private fastify: FastifyInstance) {
    this.repo = new SchedulesRepository(fastify)
    this.notificationsService = new NotificationsService(fastify)
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

  async createDailyOrders() {
    const schedules = await this.repo.findAllActive()
    const dayKey = getTomorrowDayKey()
    const scheduledDate = getTomorrowDate()

    for (const schedule of schedules) {
      try {
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
          notification.headings = { pt: 'Entrega amanhã 🍞' }
          notification.contents = { pt: `Lembrete: ${order.quantity} pães agendados para amanhã.` }
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

      await this.notificationsService.createAndTrim({
        userId: order.userId,
        type: 'DELIVERY_EVE',
        title: 'Entrega amanhã 🍞',
        body: `Lembrete: ${order.quantity} pães agendados para amanhã.`,
        actionRoute: '/client/pedidos',
      })
    }
  }

  async processAutoBuy() {
    const users = await this.prisma.user.findMany({
      where: {
        autoRecharge: { isSet: true },
      },
    })

    for (const user of users) {
      if (!user.autoRecharge) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const autoRecharge = user.autoRecharge as any

      if (!autoRecharge.active) continue

      try {
        const schedule = await this.repo.findActiveByUserId(user.id)

        let shouldBuy = false

        if (autoRecharge.mode === 'acabar') {
          // Limiar: saldo < consumo semanal
          if (schedule) {
            const weeklyQty = schedule.weeklyQty as WeeklyQty
            const consumoSemanal = Object.values(weeklyQty).reduce(
              (sum: number, v) => sum + (v as number),
              0,
            )
            shouldBuy = user.creditBalance < consumoSemanal
          }
        } else if (autoRecharge.mode === 'semanal') {
          // Verificar se hoje é o dia configurado
          const todayFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
          })
          const todayKey = DAY_OF_WEEK_MAP[todayFormatter.format(new Date())] ?? 'seg'
          shouldBuy = todayKey === autoRecharge.weekday
        }

        if (!shouldBuy) continue

        // Pix-first MVP: gerar QR Pix via prisma direto (simplificado para MVP)
        // e enviar push para o cliente finalizar o pagamento
        if (user.oneSignalPlayerId) {
          try {
            const osClient = createOsClient()
            const notification = new OneSignal.Notification()
            notification.app_id = process.env.ONESIGNAL_APP_ID!
            notification.include_subscription_ids = [user.oneSignalPlayerId]
            notification.headings = { pt: 'Cheirin de Pão — Reposição automática' }
            notification.contents = { pt: 'Toque para finalizar sua compra automática de créditos.' }
            notification.url = '/client/creditos'
            await osClient.createNotification(notification)
          } catch (pushErr) {
            this.fastify.log.warn(
              { userId: user.id, err: pushErr },
              '[schedules] falha ao enviar push de compra automática',
            )
          }
        }
      } catch (err) {
        // D-13: Se falhar, enviar push de erro e não retentar
        this.fastify.log.error({ userId: user.id, err }, '[schedules] processAutoBuy falhou')
        if (user.oneSignalPlayerId) {
          try {
            const osClient = createOsClient()
            const notification = new OneSignal.Notification()
            notification.app_id = process.env.ONESIGNAL_APP_ID!
            notification.include_subscription_ids = [user.oneSignalPlayerId]
            notification.headings = { pt: 'Cheirin de Pão' }
            notification.contents = {
              pt: 'Não conseguimos gerar sua cobrança automática — verifique seu saldo',
            }
            await osClient.createNotification(notification)
          } catch (_) {
            // Falha silenciosa no fallback de push
          }
        }
      }
    }
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

        // Calcular consumo semanal (padrão já existente em processAutoBuy)
        const weeklyQty = schedule.weeklyQty as WeeklyQty
        const consumoSemanal = Object.values(weeklyQty).reduce(
          (sum: number, v) => sum + (v as number),
          0,
        )
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
