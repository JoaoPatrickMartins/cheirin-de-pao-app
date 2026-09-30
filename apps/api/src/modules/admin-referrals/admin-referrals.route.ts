import { FastifyPluginAsync } from 'fastify'
import { AdminReferralsController } from './admin-referrals.controller.js'

/**
 * adminReferralsRoute — Indique e Ganhe, lado do admin (A1, A4 e A5). ADMIN em todas.
 *
 *   GET  /admin/referrals/summary                    — "N em análise" do hub de Gestão (A1)
 *   GET  /admin/referrals?state&q&page               — lista do A4 + contagem por chip
 *   GET  /admin/referrals/:id                        — sheet do A4 (pessoas, valores, linha do tempo)
 *   POST /admin/referrals/:id/approve                — ON_HOLD → REWARDED
 *   POST /admin/referrals/:id/reject                 — ON_HOLD → REJECTED (motivo + detalhe)
 *   GET  /admin/clients/:id/referrals                — card do detalhe do cliente (A5)
 *   GET  /admin/clients/:id/referral-code-check      — sheet "Vincular indicação" confere o código
 *   POST /admin/clients/:id/referral                 — vínculo manual
 *
 * A config (A3) mora em `admin-settings` (`/admin/settings/indicacao`), no padrão do gancho.
 * TODO campo das respostas precisa estar no schema: o `fast-json-stringify` descarta o resto.
 */

const stateKeySchema = {
  type: 'string',
  enum: ['cadastro', 'aguardando', 'analise', 'ganhou', 'recusada', 'expirou'],
  description: 'Estado (§4.2): cadastro · aguardando · analise · ganhou · recusada · expirou.',
}

const personSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID do cliente (atalho para o detalhe).' },
    name: { type: 'string', description: 'Nome completo.' },
  },
}

const countsSchema = {
  type: 'object',
  description: 'Contagem global por chip (ignora a busca).',
  properties: {
    analise: { type: 'integer' },
    aguardando: { type: 'integer', description: 'Inclui quem ainda está no cadastro.' },
    ganhou: { type: 'integer' },
    recusada: { type: 'integer' },
    expirou: { type: 'integer' },
    todas: { type: 'integer' },
  },
}

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', description: 'MongoDB ObjectId.' } },
}

const okSchema = { type: 'object', properties: { ok: { type: 'boolean' } } }

type IdParams = { Params: { id: string } }
type CodeCheckParams = IdParams & { Querystring: { code?: string } }

export const adminReferralsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminReferralsController(fastify)

  fastify.get(
    '/admin/referrals/summary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Indique e Ganhe — pendências (admin)',
        description: 'Quantas indicações aguardam a análise do admin — o selo "N em análise" do card no hub de Gestão. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { pendingReview: { type: 'integer', description: 'Indicações em análise (ON_HOLD).' } },
          },
        },
      },
    },
    ctrl.summary.bind(ctrl),
  )

  fastify.get(
    '/admin/referrals',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Listar indicações (admin)',
        description:
          'Lista do A4, 20 por página. `state` = chip (analise · aguardando · ganhou · recusada · expirou · todas; padrão analise — ordenada da mais antiga, as demais da mais recente). `q` busca pelo nome de quem indicou OU do amigo. Os sinais de análise vêm como rótulos e nunca chegam ao cliente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            state: { type: 'string', description: 'Filtro (chip). Valor desconhecido = analise.' },
            q: { type: 'string', description: 'Busca por nome (até 80 caracteres).' },
            page: { type: 'string', description: 'Página (1-based).' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    state: stateKeySchema,
                    referrer: personSchema,
                    referred: personSchema,
                    createdAt: { type: 'string', description: 'Cadastro do amigo (ISO 8601).' },
                    condo: { type: 'string', nullable: true, description: 'Condomínio do amigo.' },
                    signals: { type: 'array', items: { type: 'string' }, description: 'Rótulos dos sinais de análise.' },
                  },
                },
              },
              counts: countsSchema,
              total: { type: 'integer', description: 'Total do filtro (com a busca).' },
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.get<IdParams>(
    '/admin/referrals/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Detalhe de uma indicação (admin)',
        description:
          'O sheet do A4: as duas pessoas, sinais, valores congelados no cadastro (X, Y, campanha) e a linha do tempo — cadastro, 1º login, 1º pagamento real (sem gancho), 1ª entrega e recompensa. Recusada traz o motivo e o detalhe (só o admin vê). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              state: stateKeySchema,
              referrer: personSchema,
              referred: personSchema,
              condo: { type: 'string', nullable: true, description: 'Condomínio do amigo.' },
              signals: { type: 'array', items: { type: 'string' } },
              code: { type: 'string', description: 'Código usado (cópia do momento).' },
              source: { type: 'string', description: 'LINK · CODE · ADMIN.' },
              rewardBreads: { type: 'number', description: 'Quem indicou ganha (congelado, já com a campanha).' },
              welcomeBreads: { type: 'number', description: 'O amigo ganha (congelado; 0 = sem bônus).' },
              campaignLabel: { type: 'string', nullable: true, description: 'Campanha do cadastro, ou null.' },
              timeline: {
                type: 'object',
                properties: {
                  cadastro: { type: 'string' },
                  login: { type: 'string', nullable: true },
                  pagamento: { type: 'string', nullable: true },
                  entrega: { type: 'string', nullable: true },
                  recompensa: { type: 'string', nullable: true },
                },
              },
              reviewedAt: { type: 'string', nullable: true, description: 'Quando o admin aprovou/recusou.' },
              rejectReason: { type: 'string', nullable: true, description: 'SAME_RESIDENCE · SAME_DEVICE · DUPLICATE_ACCOUNT · OTHER.' },
              rejectDetail: { type: 'string', nullable: true },
              expiresAt: { type: 'string', nullable: true, description: 'Prazo para qualificar (null = sem prazo).' },
            },
          },
        },
      },
    },
    ctrl.detail.bind(ctrl),
  )

  fastify.post<IdParams>(
    '/admin/referrals/:id/approve',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Aprovar indicação em análise (admin)',
        description:
          'Só ON_HOLD → REWARDED (D-12): credita quem indicou e o amigo com os valores congelados, avisa os dois e confere a meta. 409 se ela não está mais em análise (outro admin decidiu antes). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
        response: { 200: okSchema },
      },
    },
    ctrl.approve.bind(ctrl),
  )

  fastify.post<IdParams>(
    '/admin/referrals/:id/reject',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Recusar indicação em análise (admin)',
        description:
          'Só ON_HOLD → REJECTED (D-12), com motivo e detalhe obrigatório. O cliente vê apenas "Não valeu"; motivo e detalhe ficam para o admin. 409 se ela não está em análise. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'SAME_RESIDENCE · SAME_DEVICE · DUPLICATE_ACCOUNT · OTHER.' },
            detail: { type: 'string', description: 'Detalhe (3..500 caracteres).' },
          },
        },
        response: { 200: okSchema },
      },
    },
    ctrl.reject.bind(ctrl),
  )

  fastify.get<IdParams>(
    '/admin/clients/:id/referrals',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Indicações de um cliente (admin)',
        description:
          'Card do detalhe do cliente (A5): o código dele (gerado aqui se ainda não existir), quem o indicou, fez / valeram / pãezins ganhos (indicações + metas) e a lista das indicações que ele fez. `active` = programa ligado (desligado, não há vínculo manual). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
        response: {
          200: {
            type: 'object',
            properties: {
              active: { type: 'boolean' },
              code: { type: 'string', nullable: true },
              referredBy: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  state: stateKeySchema,
                },
              },
              stats: {
                type: 'object',
                properties: {
                  fez: { type: 'integer' },
                  valeram: { type: 'integer' },
                  earnedBreads: { type: 'number' },
                },
              },
              referrals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    createdAt: { type: 'string' },
                    state: stateKeySchema,
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.clientReferrals.bind(ctrl),
  )

  fastify.get<CodeCheckParams>(
    '/admin/clients/:id/referral-code-check',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Conferir código para vínculo manual (admin)',
        description:
          'Sheet "Vincular indicação" (A5): válido (com nome e condomínio do dono), inválido, ou o código do próprio cliente (`self`). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
        querystring: { type: 'object', properties: { code: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              self: { type: 'boolean' },
              owner: {
                type: 'object',
                nullable: true,
                properties: {
                  name: { type: 'string' },
                  condo: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    ctrl.checkCode.bind(ctrl),
  )

  fastify.post<IdParams>(
    '/admin/clients/:id/referral',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — referrals'],
        summary: 'Vincular indicação manualmente (admin)',
        description:
          'Para quem esqueceu o código no cadastro. Uma vez só (409 se o cliente já tem indicação); 422 com o programa desligado, código inválido ou do próprio cliente. Avalia na hora: pode recompensar, ir para análise ou ficar aguardando (`outcome`). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
        body: { type: 'object', properties: { code: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              outcome: { type: 'string', description: 'PENDING · ON_HOLD · REWARDED · EXPIRED · NONE.' },
              referredBy: personSchema,
            },
          },
        },
      },
    },
    ctrl.link.bind(ctrl),
  )
}
