import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import cron from 'node-cron'
import { SchedulesService } from '../modules/schedules/schedules.service.js'
import { AdminSettingsService } from '../modules/admin-settings/admin-settings.service.js'

const cronPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Não inicializar crons em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    fastify.log.info('[cron] ambiente de teste — crons não registrados')
    return
  }

  const schedulesService = new SchedulesService(fastify)

  // Cron 1 — meia-noite diário (America/Sao_Paulo)
  // Processa compra automática + notificações de saldo baixo.
  // OBS: a criação de Orders NÃO acontece mais aqui — agora é feita no cutoffTime de cada slot
  // (cron 'cutoff-orders' por minuto), para alinhar a "confirmação" da agenda ao horário de corte.
  // node-cron v4: TaskOptions não tem 'scheduled' — tasks são iniciadas automaticamente por padrão
  cron.schedule(
    '0 0 * * *',
    async () => {
      fastify.log.info('[cron] iniciando processAutoBuy + sendLowCreditNotifications')
      try {
        await schedulesService.processAutoBuy()
        fastify.log.info('[cron] processAutoBuy concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em processAutoBuy — servidor mantido ativo')
      }

      try {
        await schedulesService.sendLowCreditNotifications()
        fastify.log.info('[cron] sendLowCreditNotifications concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendLowCreditNotifications — servidor mantido ativo')
      }
    },
    { timezone: 'America/Sao_Paulo', name: 'daily-jobs' },
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

  // Cron 4 — a cada minuto (America/Sao_Paulo)
  // No cutoffTime de cada slot: (1) cria as Orders da data alvo (Regra A) e debita créditos,
  // (2) notifica clientes que ficaram sem pedido. Por minuto para suportar cortes fora de HH:00.
  const adminSettingsService = new AdminSettingsService(fastify)
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await schedulesService.createOrdersAtCutoff()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em createOrdersAtCutoff — servidor mantido ativo')
      }

      try {
        await adminSettingsService.processCutoff()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em processCutoff — servidor mantido ativo')
      }
    },
    { timezone: 'America/Sao_Paulo', name: 'cutoff-orders' },
  )

  fastify.log.info('[cron] 4 cron jobs registrados (meia-noite jobs + domingo 20h + diário 21h + cutoff por minuto)')
})

export default cronPlugin
