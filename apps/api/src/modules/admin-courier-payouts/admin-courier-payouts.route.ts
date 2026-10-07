import type { FastifyPluginAsync } from 'fastify'
import { AdminCourierPayoutsController } from './admin-courier-payouts.controller.js'

/**
 * Pagamentos dos entregadores (plano do entregador, Onda 7 · A8). JWT + ADMIN (no controller). O
 * fast-json-stringify DESCARTA o que não estiver declarado nas respostas.
 */
const err = { type: 'object', properties: { error: { type: 'string' } } }
const nstr = { type: 'string', nullable: true }
const nnum = { type: 'number', nullable: true }

const expense = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    category: { type: 'string' },
    amount: { type: 'number' },
    status: { type: 'string', description: 'PENDING · PAID · CANCELLED' },
    paidAt: nstr,
    dueDate: nstr,
  },
}

export const payoutViewSchema = {
  type: 'object',
  properties: {
    id: { ...nstr, description: 'null na semana em andamento (só estimativa, não gravada).' },
    courierId: { type: 'string' },
    name: { type: 'string' },
    photoUrl: nstr,
    weekStart: { type: 'string' },
    weekEnd: { type: 'string' },
    status: { type: 'string', description: 'ESTIMATE · PENDING · EDITED · APPROVED · DISCARDED' },
    payMode: nstr,
    payAmount: nnum,
    units: { type: 'integer', description: 'Entregas (por entrega), rotas (por rota) ou 1 (semanal fixo).' },
    remunerationEst: { type: 'number' },
    kmEst: { type: 'number' },
    fuelEst: { type: 'number' },
    fuelBasis: {
      type: 'object',
      nullable: true,
      properties: {
        kmPorLitro: nnum,
        preco: nnum,
        combustivel: nstr,
        reason: { ...nstr, description: 'NAO_PAGA · NAO_USA · SEM_KM · SEM_CONSUMO · SEM_PRECO (combustível fora).' },
      },
    },
    remunerationFinal: nnum,
    fuelFinal: nnum,
    estimated: { type: 'number' },
    final: { type: 'number' },
    adjustReason: nstr,
    discardReason: nstr,
    approvedAt: nstr,
    paid: {
      type: 'object',
      nullable: true,
      description: 'Só na aprovada: pago / a pagar, pelas despesas lançadas.',
      properties: { state: { type: 'string', description: 'PAGO · A_PAGAR' }, paidAt: nstr, dueDate: nstr },
    },
    paymentMethod: nstr,
    expenses: { type: 'array', items: expense },
    openRuns: { type: 'integer', description: 'Rotas iniciadas e não encerradas (não entram no cálculo).' },
  },
}

const weekList = {
  type: 'object',
  properties: {
    weekStart: { type: 'string' },
    weekEnd: { type: 'string' },
    state: { type: 'string', description: 'CLOSED · CURRENT (só estimativa) · FUTURE · BEFORE_START (antes do início das propostas)' },
    since: { type: 'string', description: 'Semana a partir da qual as propostas são geradas.' },
    proposals: { type: 'array', items: payoutViewSchema },
    totals: {
      type: 'object',
      properties: { count: { type: 'integer' }, open: { type: 'integer' }, estimated: { type: 'number' }, final: { type: 'number' } },
    },
  },
}

export const adminCourierPayoutsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCourierPayoutsController(fastify)
  const pre = [fastify.authenticate]
  const tags = ['admin — pagamentos dos entregadores']
  const security = [{ bearerAuth: [] }]
  const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }

  fastify.get('/admin/courier-payouts', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Propostas da semana (A8)',
      description: 'Sem `week`, a última semana fechada. Semana fechada: gera as propostas que faltam (idempotente) e recalcula as pendentes. Semana em andamento: só estimativa.',
      querystring: { type: 'object', properties: { week: { type: 'string', description: 'Qualquer dia da semana (AAAA-MM-DD).' } } },
      response: { 200: weekList, 400: err },
    },
  }, ctrl.list.bind(ctrl))

  fastify.get('/admin/courier-payouts/history', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Histórico (aprovadas e descartadas)',
      querystring: { type: 'object', properties: { courierId: { type: 'string' }, limit: { type: 'integer' } } },
      response: { 200: { type: 'array', items: payoutViewSchema }, 400: err },
    },
  }, ctrl.history.bind(ctrl))

  fastify.get('/admin/courier-payouts/summary', {
    preHandler: pre,
    schema: { tags, security, summary: 'Propostas abertas (selo do card de Entregadores)', response: { 200: { type: 'object', properties: { open: { type: 'integer' } } } } },
  }, ctrl.summary.bind(ctrl))

  fastify.patch('/admin/courier-payouts/:id', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Editar a proposta',
      params: idParams,
      body: {
        type: 'object',
        required: ['remunerationFinal', 'fuelFinal'],
        properties: { remunerationFinal: { type: 'number' }, fuelFinal: { type: 'number' }, adjustReason: nstr },
      },
      response: { 200: payoutViewSchema, 400: err, 404: err, 409: err },
    },
  }, ctrl.edit.bind(ctrl))

  fastify.post('/admin/courier-payouts/:id/approve', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Aprovar e lançar no Financeiro',
      description: 'Cria a despesa "Entregador" e a de "Combustível" (o que for > 0), competência = mês do último dia da semana. Pago agora (data + forma) ou a pagar (vencimento). Mês fechado → 409.',
      params: idParams,
      body: {
        type: 'object',
        required: ['paid'],
        properties: { paid: { type: 'boolean' }, paidAt: { type: 'string' }, paymentMethod: nstr, dueDate: { type: 'string' } },
      },
      response: { 200: payoutViewSchema, 400: err, 404: err, 409: err },
    },
  }, ctrl.approve.bind(ctrl))

  fastify.post('/admin/courier-payouts/:id/discard', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Descartar a proposta (não vira despesa)',
      params: idParams,
      body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } },
      response: { 200: payoutViewSchema, 400: err, 404: err, 409: err },
    },
  }, ctrl.discard.bind(ctrl))
}
