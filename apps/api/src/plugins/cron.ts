import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import cron from 'node-cron'
import { SchedulesService } from '../modules/schedules/schedules.service.js'
import { AdminSettingsService } from '../modules/admin-settings/admin-settings.service.js'
import { AdminSupplierOrdersService } from '../modules/admin-supplier-orders/admin-supplier-orders.service.js'
import { CourierService } from '../modules/courier/courier.service.js'

const cronPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Não inicializar crons em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    fastify.log.info('[cron] ambiente de teste — crons não registrados')
    return
  }

  const schedulesService = new SchedulesService(fastify)

  // Cron 1 — meia-noite diário (America/Sao_Paulo)
  // Notificações de saldo baixo (para quem NÃO tem recarga automática).
  // OBS: a recarga automática NÃO acontece mais aqui — agora é JUST-IN-TIME no cutoffTime
  // de cada slot (cron 'cutoff-orders'), cobrando o cartão sem CVV no momento da order.
  // O antigo processAutoBuy (push para finalizar / modo semanal) foi descontinuado.
  cron.schedule(
    '0 0 * * *',
    async () => {
      fastify.log.info('[cron] iniciando sendLowCreditNotifications')
      try {
        await schedulesService.sendLowCreditNotifications()
        fastify.log.info('[cron] sendLowCreditNotifications concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendLowCreditNotifications — servidor mantido ativo')
      }

      // Limpa marcas de ciclos materializados antigos (MaterializedCycle).
      try {
        await schedulesService.cleanupOldMaterializedCycles()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em cleanupOldMaterializedCycles — servidor mantido ativo')
      }

      // Lembrete de agenda pausada há muito tempo (≥ 7 dias, repete semanalmente).
      try {
        await schedulesService.sendPausedTooLongReminders()
        fastify.log.info('[cron] sendPausedTooLongReminders concluído')
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendPausedTooLongReminders — servidor mantido ativo')
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
  const supplierOrdersService = new AdminSupplierOrdersService(fastify)
  const courierService = new CourierService(fastify)
  cron.schedule(
    '* * * * *',
    async () => {
      // Pré-confirmação T-2h: cobra a recarga automática com antecedência para não depender do
      // exato minuto do corte (evita que demora de processamento deixe o agendado sem confirmar).
      try {
        await schedulesService.preconfirmAutoRechargeAhead()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em preconfirmAutoRechargeAhead — servidor mantido ativo')
      }

      try {
        await schedulesService.createOrdersAtCutoff()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em createOrdersAtCutoff — servidor mantido ativo')
      }

      // Backfill: recupera cortes cujo minuto exato foi perdido (servidor fora do ar), 1x por ciclo.
      try {
        await schedulesService.backfillMissedCutoffs()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em backfillMissedCutoffs — servidor mantido ativo')
      }

      // Lembrete T-30min: avisa os admins quando falta ~30min pro corte e há pedido pendente.
      try {
        await supplierOrdersService.sendCutoffReminders()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendCutoffReminders — servidor mantido ativo')
      }

      // Notificação no MINUTO do corte: "chegou a hora de gerar o pedido".
      try {
        await supplierOrdersService.sendCutoffReachedNotifications()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendCutoffReachedNotifications — servidor mantido ativo')
      }

      // Aviso 15min antes da geração automática (corte +45, já que a rede de segurança é +60).
      try {
        await supplierOrdersService.sendAutogenWarnings()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendAutogenWarnings — servidor mantido ativo')
      }

      // Aviso de entregas pendentes após o prazo do turno (slot.time +60min).
      try {
        await supplierOrdersService.sendDeliveryPendingReminders()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendDeliveryPendingReminders — servidor mantido ativo')
      }

      // Lembrete ao entregador que não iniciou nenhuma entrega no horário do turno.
      try {
        await courierService.sendCourierPendingReminders()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em sendCourierPendingReminders — servidor mantido ativo')
      }

      // Rede de segurança: 1h APÓS o corte (janela manual), gera o pedido ao fornecedor
      // automaticamente se o admin não tiver gerado (com split padrão). Idempotente; recupera
      // cortes cujo minuto foi perdido (não depende do minuto exato).
      try {
        await supplierOrdersService.autoGenerateAtCutoff()
      } catch (err) {
        fastify.log.error({ err }, '[cron] erro em autoGenerateAtCutoff — servidor mantido ativo')
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
