import { FastifyPluginAsync } from 'fastify'
import { ReferralsController } from './referrals.controller.js'

/**
 * referralsRoute — Indique e Ganhe, lado do cliente.
 *
 * Rotas públicas (o cadastro ainda não tem sessão):
 *   GET  /referrals/config            — programa ligado? + bônus do amigo (C4)
 *   GET  /referrals/code/:code        — valida um código (10/min por IP)
 * Rotas do cliente (CLIENT):
 *   GET  /referrals/summary           — entradas leves: Perfil, Home, comemoração, extrato
 *   GET  /referrals/me                — tela Indique e ganhe (C1)
 *   POST /referrals/celebration/seen  — marca o que a comemoração mostrou
 *   POST /referrals/home-card/dismiss — fecha o card da Home por 30 dias
 *
 * TODO campo das respostas precisa estar no schema: o `fast-json-stringify` descarta o resto.
 */

const campaignSchema = {
  type: 'object',
  nullable: true,
  description: 'Campanha em vigor hoje, ou null.',
  properties: {
    label: { type: 'string', description: 'Rótulo, ex.: "Semana em dobro".' },
    until: { type: 'string', description: 'Último dia (BRT, YYYY-MM-DD, inclusivo).' },
  },
}

const goalRefSchema = {
  type: 'object',
  nullable: true,
  properties: { quantidade: { type: 'integer' }, bonus: { type: 'integer' } },
}

const okSchema = { type: 'object', properties: { ok: { type: 'boolean' } } }
export const referralsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new ReferralsController(fastify)

  fastify.get(
    '/referrals/config',
    {
      schema: {
        tags: ['referrals'],
        summary: 'Indique e Ganhe — o programa está ligado?',
        description:
          'Rota pública. O cadastro usa para decidir se mostra o campo "Tenho um código de indicação". `welcomeBreads` = pãezins que o amigo ganha quando o 1º pedido chegar (0 = sem bônus, e nenhum texto fala dele).',
        response: {
          200: {
            type: 'object',
            properties: {
              active: { type: 'boolean', description: 'Programa ligado.' },
              welcomeBreads: { type: 'integer', description: 'Bônus do amigo em pãezins inteiros (0 com o programa desligado).' },
            },
          },
        },
      },
    },
    ctrl.publicConfig.bind(ctrl),
  )

  fastify.get(
    '/referrals/code/:code',
    {
      // Público e sem sessão: o limite próprio impede varrer o espaço de códigos. Depende do
      // `trustProxy: 1` (server.ts) para contar por cliente, e não um balde só para o app todo.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['referrals'],
        summary: 'Validar um código de indicação',
        description:
          'Rota pública, 10 req/min por IP. O código é normalizado (maiúsculas, sem espaços e hífens). Válido = o programa está ligado e o dono é um cliente não bloqueado. Por privacidade, devolve só o primeiro nome + inicial do dono ("João M.").',
        params: {
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string', description: 'Código digitado ou vindo do link, ex.: JOAO7K2F.' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              referrerName: { type: 'string', description: 'Primeiro nome + inicial do dono (só quando válido).' },
              welcomeBreads: { type: 'integer', description: 'Bônus do amigo em pãezins inteiros (só quando válido).' },
            },
          },
        },
      },
    },
    ctrl.checkCode.bind(ctrl),
  )
  fastify.get(
    '/referrals/summary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['referrals'],
        summary: 'Indique e Ganhe — resumo para as entradas do app',
        description:
          'Uma chamada na abertura do app alimenta o Perfil (seção e selo "novo"/campanha), o card da Home, a comemoração e o cabeçalho do extrato. `rewardBreads` já vem com a campanha aplicada. `homeCard.visible` = programa ligado + ≥ 1 entrega recebida + card não fechado nos últimos 30 dias. `celebration` = comemoração pendente (uma por abertura: friend → goal → multi → referrer) ou null. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              active: { type: 'boolean', description: 'Programa ligado.' },
              hasReferrals: { type: 'boolean', description: 'Já indicou alguém — com o programa desligado, só estes veem a entrada no Perfil (tela pausada).' },
              isNew: { type: 'boolean', description: 'Ainda não abriu a tela (sem código) — selo "novo" no Perfil.' },
              rewardBreads: { type: 'integer', description: 'X × campanha: quanto ganha por indicação feita hoje.' },
              campaign: campaignSchema,
              homeCard: { type: 'object', properties: { visible: { type: 'boolean' } } },
              bonusThisMonth: { type: 'number', description: 'Pãezins de indicação (bônus, boas-vindas e metas) creditados no mês BRT.' },
              celebration: {
                type: 'object',
                nullable: true,
                properties: {
                  variant: { type: 'string', enum: ['friend', 'goal', 'multi', 'referrer'] },
                  breads: { type: 'number' },
                  names: { type: 'array', items: { type: 'string' }, description: 'Primeiros nomes de quem recebeu o 1º pedido.' },
                  referrerName: { type: 'string', nullable: true, description: 'Primeiro nome de quem indicou (friend).' },
                  goal: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      threshold: { type: 'integer' },
                      bonus: { type: 'number' },
                      next: {
                        type: 'object',
                        nullable: true,
                        properties: { threshold: { type: 'integer' }, bonus: { type: 'number' } },
                      },
                    },
                  },
                  seen: {
                    type: 'object',
                    description: 'Mandar de volta em POST /referrals/celebration/seen quando o modal fechar.',
                    properties: {
                      referralIds: { type: 'array', items: { type: 'string' } },
                      goalThresholds: { type: 'array', items: { type: 'integer' } },
                      welcome: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.summary.bind(ctrl),
  )

  fastify.get(
    '/referrals/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['referrals'],
        summary: 'Indique e Ganhe — tela do cliente (C1)',
        description:
          'Código, valores, regras, resumo, metas e a lista de indicados (só primeiro nome + inicial, estado e data). Com o programa ligado, o código é gerado na primeira chamada. Desligado: `state: "paused"` e `code: null` (só histórico). A mensagem vem como modelo (`messageTemplate`, com {codigo} {link} {nome} {bonus}) — o app monta o link com a própria origem. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              state: { type: 'string', enum: ['active', 'paused'] },
              code: { type: 'string', nullable: true, description: 'Código do cliente (null com o programa pausado).' },
              messageTemplate: { type: 'string' },
              referrerFirstName: { type: 'string', description: 'O {nome} da mensagem.' },
              rewardBreads: { type: 'integer', description: 'X × campanha.' },
              baseRewardBreads: { type: 'integer', description: 'X sem campanha — o "Em vez de 5…".' },
              welcomeBreads: { type: 'integer', description: 'Y (0 = sem bônus do amigo).' },
              campaign: campaignSchema,
              rules: {
                type: 'object',
                properties: { prazoDias: { type: 'integer' }, compraMinima: { type: 'number' } },
              },
              stats: {
                type: 'object',
                properties: {
                  earnedBreads: { type: 'number', description: 'Indicações + metas, tudo o que o programa já deu.' },
                  valeram: { type: 'integer' },
                  emAndamento: { type: 'integer' },
                },
              },
              goals: {
                type: 'object',
                properties: {
                  count: { type: 'integer', description: 'Indicações que valeram.' },
                  milestones: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        quantidade: { type: 'integer' },
                        bonus: { type: 'integer' },
                        reached: { type: 'boolean' },
                        paid: { type: 'boolean', description: 'O bônus desta meta foi pago (meta criada depois de passada não paga).' },
                      },
                    },
                  },
                  justHit: goalRefSchema,
                  next: goalRefSchema,
                },
              },
              referrals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string', description: '"Maria S."' },
                    state: { type: 'string', enum: ['cadastro', 'aguardando', 'analise', 'ganhou', 'recusada', 'expirou'] },
                    date: { type: 'string', description: 'ISO — quando valeu (ganhou) ou quando o amigo se cadastrou.' },
                    rewardBreads: { type: 'number', nullable: true },
                    campaign: { type: 'boolean', description: 'Teve multiplicador de campanha ("em dobro").' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.me.bind(ctrl),
  )

  fastify.post(
    '/referrals/celebration/seen',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['referrals'],
        summary: 'Marcar a comemoração como vista',
        description: 'Recebe o `celebration.seen` do summary. Só marca o que é do próprio cliente. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            referralIds: { type: 'array', items: { type: 'string' } },
            goalThresholds: { type: 'array', items: { type: 'integer' } },
            welcome: { type: 'boolean' },
          },
        },
        response: { 200: okSchema },
      },
    },
    ctrl.celebrationSeen.bind(ctrl),
  )

  fastify.post(
    '/referrals/home-card/dismiss',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['referrals'],
        summary: 'Fechar o card da Home por 30 dias',
        description: 'Guardado no servidor (vale em qualquer aparelho). Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: { 200: okSchema },
      },
    },
    ctrl.dismissHomeCard.bind(ctrl),
  )
}
