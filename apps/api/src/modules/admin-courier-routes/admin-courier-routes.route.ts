import type { FastifyPluginAsync } from 'fastify'
import { AdminCourierRoutesController } from './admin-courier-routes.controller.js'

/**
 * Rotas dos entregadores no admin (plano do entregador, Onda 5). Todas exigem JWT + ADMIN (checado
 * no controller). O fast-json-stringify DESCARTA o que não estiver declarado nas respostas.
 */
const geometry = { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Traçado [lat, lng].' }
const condo = {
  type: 'object',
  properties: { id: { type: 'string' }, name: { type: 'string' }, lat: { type: 'number', nullable: true }, lng: { type: 'number', nullable: true } },
}
const base = {
  type: 'object',
  nullable: true,
  properties: { endereco: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } },
}
const routeView = {
  type: 'object',
  properties: {
    courier: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    slot: { type: 'object', properties: { slotId: { type: 'string' }, label: { type: 'string' }, emoji: { type: 'string' }, time: { type: 'string' } } },
    base,
    condos: { type: 'array', items: condo },
    saved: {
      type: 'object',
      nullable: true,
      description: 'Rota salva (aceita pelo admin). null = ainda não há.',
      properties: {
        condominiumIds: { type: 'array', items: { type: 'string' } },
        km: { type: 'number', nullable: true },
        durationMin: { type: 'integer', nullable: true },
        geometry,
        acceptedAt: { type: 'string' },
      },
    },
    suggestion: {
      type: 'object',
      nullable: true,
      description: 'Sugestão pendente: FIRST (1ª rota) ou NEW_CONDO (prédio novo).',
      properties: {
        condominiumIds: { type: 'array', items: { type: 'string' } },
        km: { type: 'number', nullable: true },
        durationMin: { type: 'integer', nullable: true },
        geometry,
        reason: { type: 'string' },
        newIds: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string' },
        deltaKm: { type: 'number', nullable: true, description: 'km da sugestão − km da rota salva.' },
      },
    },
    followsDefault: { type: 'boolean', description: 'Sem rota própria: o turno segue a rota padrão (plano-rota-padrao, D-2).' },
    defaultOrder: {
      type: 'object',
      nullable: true,
      description: 'A rota padrão com os prédios deste entregador/turno (últimos 30 dias + rota própria). null = não há rota padrão.',
      properties: {
        condominiumIds: { type: 'array', items: { type: 'string' } },
        km: { type: 'number', nullable: true },
        durationMin: { type: 'integer', nullable: true },
        geometry,
      },
    },
    changes: {
      type: 'array',
      description: 'Dias em que o entregador mudou a ordem (30 dias).',
      items: {
        type: 'object',
        properties: {
          runId: { type: 'string' },
          date: { type: 'string' },
          condominiumIds: { type: 'array', items: { type: 'string' } },
          km: { type: 'number', nullable: true },
          description: { type: 'string' },
        },
      },
    },
  },
}
const err = { type: 'object', properties: { error: { type: 'string' } } }
const defaultRouteView = {
  type: 'object',
  properties: {
    base,
    voltaBase: { type: 'boolean' },
    saved: {
      type: 'object',
      nullable: true,
      description: 'Rota padrão salva. null = ainda não há (a tela abre com a sugestão, D-10).',
      properties: {
        condominiumIds: { type: 'array', items: { type: 'string' } },
        km: { type: 'number', nullable: true },
        durationMin: { type: 'integer', nullable: true },
        geometry,
        savedAt: { type: 'string', description: 'Último "Salvar" do admin.' },
        savedByName: { type: 'string', nullable: true },
      },
    },
    condos: {
      type: 'array',
      description: 'Ativos com localização (os que entram na rota), por nome.',
      items: {
        type: 'object',
        properties: {
          ...condo.properties,
          approxLocation: { type: 'boolean' },
          flag: { type: 'string', nullable: true, description: 'NOVO | REENCAIXADO — encaixe automático ainda não revisado.' },
          kmAdded: { type: 'number', nullable: true, description: 'km que o encaixe somou à rota.' },
        },
      },
    },
    outside: {
      type: 'array',
      description: 'Ativos sem localização ("fora do mapa").',
      items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
    },
  },
}
const orderBody = {
  type: 'object',
  required: ['condominiumIds'],
  properties: { condominiumIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 } },
}

export const adminCourierRoutesRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCourierRoutesController(fastify)
  const pre = [fastify.authenticate]
  const tags = ['admin — rotas']
  const security = [{ bearerAuth: [] }]

  fastify.get('/admin/couriers/:id/routes/:slotId', {
    preHandler: pre,
    schema: { tags, security, summary: 'Rota do entregador num turno (A4)', description: 'Rota salva, sugestão pendente e as alterações que o entregador fez nos últimos 30 dias.', response: { 200: routeView, 404: err } },
  }, ctrl.getRoute.bind(ctrl))

  fastify.post('/admin/couriers/:id/routes/:slotId/accept', {
    preHandler: pre,
    schema: { tags, security, summary: 'Usar a sugestão', description: 'A sugestão vira a rota salva (vale a partir da próxima rota). 404 sem sugestão.', response: { 200: routeView, 404: err } },
  }, ctrl.accept.bind(ctrl))

  fastify.post('/admin/couriers/:id/routes/:slotId/keep', {
    preHandler: pre,
    schema: { tags, security, summary: 'Manter a rota atual', description: 'A ordem salva continua; os prédios novos entram na posição sugerida. 400 sem rota salva; 404 sem sugestão.', response: { 200: routeView, 400: err, 404: err } },
  }, ctrl.keep.bind(ctrl))

  fastify.put('/admin/couriers/:id/routes/:slotId', {
    preHandler: pre,
    schema: { tags, security, summary: 'Salvar a ordem ajustada', body: orderBody, response: { 200: routeView, 400: err, 404: err } },
  }, ctrl.save.bind(ctrl))

  fastify.post('/admin/couriers/:id/routes/:slotId/adopt/:runId', {
    preHandler: pre,
    schema: { tags, security, summary: 'Adotar a ordem que o entregador usou num dia', response: { 200: routeView, 404: err } },
  }, ctrl.adopt.bind(ctrl))

  fastify.post('/admin/couriers/:id/routes/:slotId/reset', {
    preHandler: pre,
    schema: { tags, security, summary: 'Voltar à rota padrão', description: 'Apaga a rota própria do entregador/turno, que passa a seguir a rota padrão (o histórico de economia fica). 400 sem rota padrão.', response: { 200: routeView, 400: err, 404: err } },
  }, ctrl.reset.bind(ctrl))

  fastify.get('/admin/default-route', {
    preHandler: pre,
    schema: { tags, security, summary: 'Rota padrão', description: 'Encaixa antes o que faltar (prédio novo, reativado ou que mudou de lugar) e devolve a rota salva, os prédios que entram (com o selo do encaixe) e os sem localização.', response: { 200: defaultRouteView } },
  }, ctrl.defaultRoute.bind(ctrl))

  fastify.post('/admin/default-route/suggest', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Sugerir rota (rota padrão)',
      description: 'Melhor ordem para todos os condomínios ativos com localização, saindo da base. Não grava. `computed: false` = mapa fora do ar.',
      response: {
        200: {
          type: 'object',
          properties: {
            condominiumIds: { type: 'array', items: { type: 'string' } },
            km: { type: 'number', nullable: true },
            durationMin: { type: 'integer', nullable: true },
            geometry,
            computed: { type: 'boolean' },
            deltaKm: { type: 'number', nullable: true, description: 'km da sugestão − km da rota salva.' },
          },
        },
      },
    },
  }, ctrl.suggestDefault.bind(ctrl))

  fastify.put('/admin/default-route', {
    preHandler: pre,
    schema: { tags, security, summary: 'Salvar a rota padrão', description: 'Ignora o prédio que deixou de entrar (inativo, sem localização); encaixa o que faltar. 400 lista vazia ou repetida.', body: orderBody, response: { 200: defaultRouteView, 400: err } },
  }, ctrl.saveDefault.bind(ctrl))

  fastify.post('/admin/default-route/review', {
    preHandler: pre,
    schema: { tags, security, summary: '"Está bom assim" (encaixes revisados)', description: 'Os encaixes automáticos ficam como estão e os selos somem. 404 sem rota padrão.', response: { 200: defaultRouteView, 404: err } },
  }, ctrl.reviewDefault.bind(ctrl))

  fastify.post('/admin/routes/preview', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'km e tempo de uma ordem (o "Ajustar" recalcula ao soltar)',
      body: orderBody,
      response: { 200: { type: 'object', properties: { km: { type: 'number', nullable: true }, durationMin: { type: 'integer', nullable: true }, geometry } } },
    },
  }, ctrl.preview.bind(ctrl))

  fastify.get('/admin/couriers/live', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Rotas de hoje ao vivo (A2)',
      description: 'Estado, progresso, última posição (só com a rota iniciada), término previsto, "sem foto" e "ordem alterada" por entregador/turno; as paradas e os prédios do mapa. O admin consulta a cada 30 s.',
      response: {
        200: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            base,
            routes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  courierId: { type: 'string' },
                  courierName: { type: 'string' },
                  slotId: { type: 'string' },
                  slotLabel: { type: 'string' },
                  slotEmoji: { type: 'string' },
                  state: { type: 'string', description: 'pronta | em_rota | encerrada.' },
                  startedAt: { type: 'string', nullable: true },
                  endedAt: { type: 'string', nullable: true },
                  etaEnd: { type: 'string', nullable: true, description: 'Término previsto (HH:MM).' },
                  done: { type: 'integer' },
                  total: { type: 'integer' },
                  noPhoto: { type: 'integer' },
                  reordered: { type: 'boolean' },
                  lastPos: {
                    type: 'object',
                    nullable: true,
                    properties: { lat: { type: 'number' }, lng: { type: 'number' }, at: { type: 'string' }, stale: { type: 'boolean' } },
                  },
                },
              },
            },
            stops: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  courierId: { type: 'string' },
                  slotId: { type: 'string' },
                  condominiumId: { type: 'string', nullable: true },
                  condominiumName: { type: 'string' },
                  clientName: { type: 'string' },
                  apartment: { type: 'string' },
                  block: { type: 'string', nullable: true },
                  status: { type: 'string', description: 'pendente | entregue | nao_entregue.' },
                  time: { type: 'string', nullable: true },
                  failureLabel: { type: 'string', nullable: true },
                  proof: { type: 'string', nullable: true, description: 'ok | pendente | sem | pulada.' },
                  noPhoto: { type: 'boolean' },
                  noPhotoNote: { type: 'string', nullable: true },
                },
              },
            },
            condos: { type: 'array', items: { ...condo, properties: { ...condo.properties, done: { type: 'boolean' } } } },
          },
        },
      },
    },
  }, ctrl.live.bind(ctrl))

  fastify.get('/admin/geocode', {
    preHandler: pre,
    schema: {
      tags,
      security,
      summary: 'Buscar endereço (base de saída, A5)',
      querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string' } } },
      response: {
        200: {
          type: 'object',
          properties: { results: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } } } } },
        },
        400: err,
      },
    },
  }, ctrl.geocode.bind(ctrl))
}
