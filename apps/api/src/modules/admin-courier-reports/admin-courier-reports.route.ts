import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { AdminCourierReportsService } from './admin-courier-reports.service.js'

/**
 * Problemas e ocorrências dos entregadores (Onda 8). JWT + ADMIN. O fast-json-stringify DESCARTA o
 * que não estiver declarado nas respostas.
 */
const err = { type: 'object', properties: { error: { type: 'string' } } }
const nstr = { type: 'string', nullable: true }
const reportView = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: { type: 'string', description: 'STOP_ISSUE (problema numa entrega) · INCIDENT (ocorrência)' },
    type: { type: 'string' },
    label: { type: 'string' },
    text: nstr,
    photoUrl: { ...nstr, description: 'URL assinada (10 min) da foto da ocorrência.' },
    photoExpired: { type: 'boolean', description: 'Houve foto, mas passou dos 90 dias (sem URL).' },
    status: { type: 'string', description: 'OPEN · RESOLVED' },
    resolution: { ...nstr, description: 'KEPT · CORRECTED · DONE' },
    createdAt: { type: 'string' },
    resolvedAt: nstr,
    courier: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    stop: {
      type: 'object',
      nullable: true,
      properties: { orderId: nstr, marketOrderId: nstr, clientName: { type: 'string' }, place: { type: 'string' }, status: nstr },
    },
  },
}

export const adminCourierReportsRoute: FastifyPluginAsync = async (fastify) => {
  const svc = new AdminCourierReportsService(fastify)
  const pre = [fastify.authenticate]
  const tags = ['admin — entregadores']
  const security = [{ bearerAuth: [] }]

  const run = async <T>(request: FastifyRequest, reply: FastifyReply, work: () => Promise<T>) => {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso restrito ao administrador' })
    try {
      return reply.status(200).send(await work())
    } catch (e) {
      const x = e as { statusCode?: number; message?: string }
      if (x.statusCode === 404 || x.statusCode === 400) return reply.status(x.statusCode).send({ error: x.message })
      fastify.log.error(e)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  fastify.get('/admin/courier-reports', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Problemas e ocorrências dos entregadores',
      querystring: { type: 'object', properties: { status: { type: 'string', description: 'open (padrão) · all' } } },
      response: { 200: { type: 'array', items: reportView } },
    },
  }, (request, reply) => run(request, reply, () => svc.list((request.query as { status?: string }).status === 'all' ? 'ALL' : 'OPEN')))

  fastify.get('/admin/courier-reports/summary', {
    preHandler: pre,
    schema: { tags, security, summary: 'Reportes abertos (selo)', response: { 200: { type: 'object', properties: { open: { type: 'integer' } } } } },
  }, (request, reply) => run(request, reply, () => svc.summary()))

  fastify.post('/admin/courier-reports/:id/resolve', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: '"Manter entregue" / "Resolvida"',
      description: 'Problema numa entrega → KEPT (a entrega continua entregue). Ocorrência → DONE. Para corrigir para não entregue, use POST /admin/orders/:id/correct-not-delivered.',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, resolution: nstr } }, 404: err },
    },
  }, (request, reply) =>
    run(request, reply, () => {
      const { id } = request.params as { id: string }
      if (!/^[0-9a-f]{24}$/i.test(id)) throw { statusCode: 400, message: 'Id inválido' }
      return svc.resolve(id, request.user!.id)
    }),
  )
}
