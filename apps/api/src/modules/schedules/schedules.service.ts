import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { SchedulesRepository } from './schedules.repository.js'
import { ScheduleBody, WeeklyQty } from './schedules.schema.js'

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

  constructor(private fastify: FastifyInstance) {
    this.repo = new SchedulesRepository(fastify)
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
            notification.url = '/client/comprar'
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
}
