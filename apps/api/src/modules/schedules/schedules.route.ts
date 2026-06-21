import { FastifyPluginAsync } from 'fastify'
import { SchedulesController } from './schedules.controller.js'

export const schedulesRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new SchedulesController(fastify)

  fastify.get(
    '/schedules/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['schedules'],
        summary: 'Consultar agenda semanal',
        description: 'Retorna a agenda semanal personalizada do cliente autenticado. A agenda define quantos pãezinhos serão entregues em cada dia da semana e em qual horário. Uma vez configurada, o sistema gera os pedidos automaticamente sem que o cliente precise fazer nada. Retorna null se o cliente ainda não configurou a agenda.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Agenda semanal atual do cliente.',
            properties: {
              id: { type: 'string', description: 'ID da agenda (MongoDB ObjectId).' },
              weeklyQty: {
                type: 'object',
                description: 'Quantidade de pãezinhos por dia da semana (0 = sem entrega naquele dia).',
                properties: {
                  seg: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos na segunda-feira.' },
                  ter: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos na terça-feira.' },
                  qua: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos na quarta-feira.' },
                  qui: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos na quinta-feira.' },
                  sex: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos na sexta-feira.' },
                  sab: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos no sábado.' },
                  dom: { type: 'integer', minimum: 0, maximum: 12, description: 'Pãezinhos no domingo.' },
                },
              },
              deliveryTime: { type: 'string', description: 'Horário preferido de entrega: "06:30", "07:00", "07:30" ou "08:00".' },
              notifyReconfigure: { type: 'boolean', description: 'true se o cliente quer ser notificado quando créditos estiverem baixos para reconfigurar a agenda.' },
              days: {
                type: 'object',
                nullable: true,
                description: 'Agenda multi-slot: chave = horário HH:MM, valor = WeeklyQty. Presente quando o condomínio tem 2+ slots ativos.',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    seg: { type: 'integer' }, ter: { type: 'integer' }, qua: { type: 'integer' },
                    qui: { type: 'integer' }, sex: { type: 'integer' }, sab: { type: 'integer' },
                    dom: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getMySchedule.bind(ctrl),
  )

  fastify.put(
    '/schedules/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['schedules'],
        summary: 'Criar ou atualizar agenda semanal',
        description: 'Cria ou atualiza a agenda semanal de entregas do cliente. A agenda é a feature core do produto — o cliente configura uma vez e os pãezinhos chegam todo dia automaticamente. O sistema deduz créditos automaticamente para cobrir as entregas programadas. Dias com qty=0 não geram pedidos. Alterações afetam apenas pedidos futuros (não cancela pedidos já programados para hoje).',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          description: 'Aceita formato single-slot (weeklyQty+deliveryTime) ou multi-slot (days). Validação semântica via Zod no controller.',
          properties: {
            days: {
              type: 'object',
              description: 'Multi-slot: chave = horário HH:MM, valor = WeeklyQty.',
              additionalProperties: { type: 'object' },
            },
            weeklyQty: {
              type: 'object',
              description: 'Single-slot: quantidade de pãezinhos por dia. Use 0 para dias sem entrega.',
              properties: {
                seg: { type: 'integer', minimum: 0, maximum: 12 },
                ter: { type: 'integer', minimum: 0, maximum: 12 },
                qua: { type: 'integer', minimum: 0, maximum: 12 },
                qui: { type: 'integer', minimum: 0, maximum: 12 },
                sex: { type: 'integer', minimum: 0, maximum: 12 },
                sab: { type: 'integer', minimum: 0, maximum: 12 },
                dom: { type: 'integer', minimum: 0, maximum: 12 },
              },
            },
            deliveryTime: { type: 'string', description: 'Janela de entrega (single-slot). Ex: "06:30".' },
            notifyReconfigure: { type: 'boolean', description: 'Se true, recebe push quando créditos ficarem baixos.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Agenda atualizada com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID da agenda.' },
              weeklyQty: {
                type: 'object',
                description: 'Agenda salva (single-slot).',
                // properties explícitas: sem elas o fast-json-stringify remove as chaves seg..dom
                properties: {
                  seg: { type: 'integer' }, ter: { type: 'integer' }, qua: { type: 'integer' },
                  qui: { type: 'integer' }, sex: { type: 'integer' }, sab: { type: 'integer' },
                  dom: { type: 'integer' },
                },
              },
              deliveryTime: { type: 'string', description: 'Horário de entrega configurado.' },
              notifyReconfigure: { type: 'boolean', description: 'Preferência de notificação salva.' },
              days: {
                type: 'object',
                nullable: true,
                description: 'Agenda multi-slot salva.',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    seg: { type: 'integer' }, ter: { type: 'integer' }, qua: { type: 'integer' },
                    qui: { type: 'integer' }, sex: { type: 'integer' }, sab: { type: 'integer' },
                    dom: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.updateMySchedule.bind(ctrl),
  )
}
