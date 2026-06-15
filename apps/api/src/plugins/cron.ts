import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import cron from 'node-cron'
import { SchedulesService } from '../modules/schedules/schedules.service.js'

const cronPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Não inicializar crons em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    fastify.log.info('[cron] ambiente de teste — crons não registrados')
    return
  }

  const schedulesService = new SchedulesService(fastify)

  // Cron 1 — meia-noite diário (America/Sao_Paulo)
  // Cria Orders do dia seguinte para todos os schedules ativos e processa compra automática
  // node-cron v4: TaskOptions não tem 'scheduled' — tasks são iniciadas automaticamente por padrão
  cron.schedule(
    '0 0 * * *',
    async () => {
      fastify.log.info('[cron] iniciando createDailyOrders + processAutoBuy')
      try {
        await schedulesService.createDailyOrders()
        fastify.log.info('[cron] createDailyOrders concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em createDailyOrders — servidor mantido ativo')
      }

      try {
        await schedulesService.processAutoBuy()
        fastify.log.info('[cron] processAutoBuy concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em processAutoBuy — servidor mantido ativo')
      }
    },
    { timezone: 'America/Sao_Paulo', name: 'daily-orders' },
  )

  // Cron 2 — domingo 20h (America/Sao_Paulo)
  // Envia push de lembrete de reconfiguração semanal para usuários com notifyReconfigure: true
  cron.schedule(
    '0 20 * * 0',
    async () => {
      fastify.log.info('[cron] iniciando sendReconfigureReminders')
      try {
        await schedulesService.sendReconfigureReminders()
        fastify.log.info('[cron] sendReconfigureReminders concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendReconfigureReminders — servidor mantido ativo')
      }
    },
    { timezone: 'America/Sao_Paulo', name: 'weekly-reminder' },
  )

  // Cron 3 — diário 21h (America/Sao_Paulo)
  // Envia push de véspera e persiste Notification DELIVERY_EVE para cada order do dia seguinte
  cron.schedule(
    '0 21 * * *',
    async () => {
      fastify.log.info('[cron] iniciando sendEveReminders')
      try {
        await schedulesService.sendEveReminders()
        fastify.log.info('[cron] sendEveReminders concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendEveReminders — servidor mantido ativo')
      }
    },
    { timezone: 'America/Sao_Paulo', name: 'eve-reminders' },
  )

  fastify.log.info('[cron] 3 cron jobs registrados (meia-noite diário + domingo 20h + diário 21h)')
})

export default cronPlugin
