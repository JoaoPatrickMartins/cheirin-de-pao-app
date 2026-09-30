import { FastifyPluginAsync } from 'fastify'
import { CondoInterestsController } from './condo-interests.controller.js'

/**
 * condoInterestsRoute — lista de espera de condomínio (C8 → A7, §7.11).
 *
 *   POST  /condominiums/interest                 — pública, 5/min por IP
 *   GET   /admin/condominiums/interests          — grupos do A7 (ADMIN)
 *   PATCH /admin/condominiums/interests/handled  — marca ou reabre um grupo (ADMIN)
 *
 * TODO campo das respostas precisa estar no schema: o `fast-json-stringify` descarta o resto.
 */
export const condoInterestsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CondoInterestsController(fastify)

  fastify.post(
    '/condominiums/interest',
    {
      // Pública e sem sessão: o limite próprio segura spam na lista e nos avisos ao admin. Depende
      // do `trustProxy: 1` (server.ts) para contar por cliente.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['condominiums'],
        summary: 'Lista de espera — meu condomínio não está aqui',
        description:
          'Rota pública, 5 req/min por IP. O visitante pede um condomínio ainda não atendido. `contact` é o campo único "E-mail ou celular": com "@" é e-mail, senão celular (dígitos). Inválido → 400 com a mensagem do campo. `refCode` = código de indicação guardado do link (mede a demanda que o programa gera). O mesmo contato no mesmo condomínio não é gravado duas vezes. Avisa os admins (ADMIN_CONDO_INTEREST).',
        body: {
          type: 'object',
          properties: {
            condoName: { type: 'string', description: 'Nome do condomínio.' },
            zip: { type: 'string', description: 'CEP (opcional, 8 dígitos).' },
            city: { type: 'string', description: 'Cidade (obrigatória).' },
            contactName: { type: 'string', description: 'Nome de quem pede.' },
            contact: { type: 'string', description: 'E-mail ou celular.' },
            refCode: { type: 'string', description: 'Código de indicação do link, se houver.' },
            visitorId: { type: 'string', description: 'ID anônimo do aparelho (device_id).' },
          },
        },
        response: { 201: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    ctrl.create.bind(ctrl),
  )

  fastify.get(
    '/admin/condominiums/interests',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — condominiums'],
        summary: 'Pedidos de novos condomínios (admin)',
        description:
          'Grupos por condomínio (nome + cidade normalizados): nº de pedidos, quantos vieram por indicação, se o grupo foi tratado e os contatos. Em aberto primeiro, depois por nº de pedidos; tratados no fim. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'Chave do grupo (usada no PATCH).' },
                    name: { type: 'string' },
                    city: { type: 'string' },
                    count: { type: 'integer' },
                    viaReferral: { type: 'integer', description: 'Pedidos com código de indicação.' },
                    handled: { type: 'boolean', description: 'Todos os pedidos do grupo marcados como tratados.' },
                    lastAt: { type: 'string', description: 'Pedido mais recente (ISO 8601).' },
                    contacts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string', nullable: true },
                          phone: { type: 'string', nullable: true, description: 'Só dígitos.' },
                          createdAt: { type: 'string' },
                          viaReferral: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.patch(
    '/admin/condominiums/interests/handled',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — condominiums'],
        summary: 'Marcar/reabrir um grupo de pedidos (admin)',
        description:
          'Marca como tratado (ou reabre) o grupo inteiro. Um pedido novo num grupo tratado o reabre sozinho. 404 se o grupo não existe. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            groupKey: { type: 'string' },
            handled: { type: 'boolean' },
          },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    ctrl.setHandled.bind(ctrl),
  )
}
