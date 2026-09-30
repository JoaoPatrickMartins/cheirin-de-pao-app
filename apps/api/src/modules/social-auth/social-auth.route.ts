import { FastifyPluginAsync } from 'fastify'
import { SocialAuthController } from './social-auth.controller.js'

// Login social (Google) — plano: .projeto/docs/plano-login-social.md (§7.3).
// Todo campo das respostas PRECISA estar declarado aqui: o Fastify descarta o que não estiver.

const limit = (max: number) => ({ rateLimit: { max, timeWindow: '1 minute' } })

const providerParams = {
  type: 'object',
  required: ['provider'],
  properties: { provider: { type: 'string', description: 'Provedor de login. Hoje só `google`.' } },
}

const flowAuthProps = {
  flowId: { type: 'string', description: 'ID do fluxo devolvido por /start.' },
  secret: { type: 'string', description: 'Segredo devolvido por /start — só o app que iniciou o conhece.' },
}

const deviceIdProp = {
  deviceId: { type: 'string', description: 'UUID do dispositivo — o mesmo usado no /start.' },
}

const startResponse = {
  type: 'object',
  properties: {
    flowId: { type: 'string', description: 'ID do fluxo — guardar junto com o secret.' },
    secret: { type: 'string', description: 'Segredo do fluxo. Nunca vai para a URL.' },
    authUrl: { type: 'string', description: 'Para onde levar o navegador (consentimento do Google).' },
  },
}

// Resposta comum do claim e dos passos seguintes (vínculo, cadastro).
const claimResponse = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['PENDING', 'LOGGED_IN', 'NEEDS_SIGNUP', 'NEEDS_LINK', 'LINKED', 'ERROR'],
      description: 'Desfecho. PENDING = o Google ainda não devolveu; tente de novo.',
    },
    code: {
      type: 'string',
      description: 'Só em ERROR: cancelled | not_client | blocked | email_unverified | expired | already_linked | provider_taken | provider_error.',
    },
    accessToken: { type: 'string', description: 'LOGGED_IN: access token JWT (~15 min).' },
    refreshToken: { type: 'string', description: 'LOGGED_IN: refresh token (90 dias).' },
    hasPassword: { type: 'boolean', description: 'LOGGED_IN: a conta tem senha.' },
    mustSetPassword: { type: 'boolean', description: 'LOGGED_IN: sempre false para quem entra pelo Google.' },
    user: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' } },
    },
    prefill: {
      type: 'object',
      description: 'NEEDS_SIGNUP: o que o Google já entregou para o cadastro "Quase lá".',
      properties: { name: { type: 'string' }, email: { type: 'string' }, provider: { type: 'string' } },
    },
    maskedEmail: { type: 'string', description: 'NEEDS_LINK: e-mail da conta encontrada, mascarado (ma•••@gmail.com).' },
    canUsePassword: { type: 'boolean', description: 'NEEDS_LINK: a conta tem senha (senão, só código).' },
    provider: { type: 'string', description: 'LINKED: provedor conectado.' },
  },
}

export const socialAuthRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new SocialAuthController(fastify)

  fastify.get('/auth/social/providers', {
    schema: {
      tags: ['auth'],
      summary: 'Provedores de login social ligados',
      description: 'Diz quais botões o app deve mostrar. O Google só liga com GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e API_PUBLIC_URL configurados. Rota pública.',
      response: { 200: { type: 'object', properties: { google: { type: 'boolean' } } } },
    },
  }, ctrl.providers.bind(ctrl))

  fastify.post('/auth/social/:provider/start', {
    config: limit(10),
    schema: {
      tags: ['auth'],
      summary: 'Iniciar login/cadastro com o Google',
      description: 'Cria o fluxo (state + PKCE ficam no servidor) e devolve a URL do Google. O app guarda flowId + secret e busca o resultado em /auth/social/claim. Para conectar pelo Perfil, use /connect. Rate limit: 10/min. Rota pública.',
      params: providerParams,
      body: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          intent: { type: 'string', description: 'Sempre `login` aqui (padrão).' },
          ...deviceIdProp,
        },
      },
      response: { 200: startResponse },
    },
  }, ctrl.start.bind(ctrl))

  fastify.post('/auth/social/:provider/connect', {
    preHandler: [fastify.authenticate],
    config: limit(10),
    schema: {
      tags: ['auth'],
      summary: 'Conectar o Google à conta logada (Perfil)',
      description: 'Igual ao /start, mas amarra o fluxo ao cliente logado: no retorno o Google fica conectado (LINKED) sem pedir confirmação. Só CLIENT. Rate limit: 10/min.',
      security: [{ bearerAuth: [] }],
      params: providerParams,
      body: { type: 'object', required: ['deviceId'], properties: deviceIdProp },
      response: { 200: startResponse },
    },
  }, ctrl.connect.bind(ctrl))

  fastify.get('/auth/social/:provider/callback', {
    config: limit(30),
    schema: {
      tags: ['auth'],
      summary: 'Retorno do Google (navegação do provedor)',
      description: 'O Google redireciona para cá com code + state. A API troca o código, decide o desfecho, grava no fluxo e devolve o navegador para a raiz do app (`/?social=<flowId>`). Nunca mostra erro técnico: falhas voltam como `/?social_error=...` ou no /claim.',
      params: providerParams,
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string', description: 'Ex.: access_denied quando a pessoa cancela.' },
        },
      },
    },
  }, ctrl.callback.bind(ctrl))

  fastify.post('/auth/social/claim', {
    config: limit(60),
    schema: {
      tags: ['auth'],
      summary: 'Buscar o resultado do login com o Google',
      description: 'O app chama ao voltar (e em polling enquanto espera). Exige flowId + secret + o mesmo deviceId do /start. LOGGED_IN é entregue uma vez só. Rate limit: 60/min. Rota pública.',
      body: { type: 'object', required: ['flowId', 'secret', 'deviceId'], properties: { ...flowAuthProps, ...deviceIdProp } },
      response: { 200: claimResponse },
    },
  }, ctrl.claim.bind(ctrl))

  fastify.post('/auth/social/link/code', {
    config: limit(5),
    schema: {
      tags: ['auth'],
      summary: 'Vínculo: mandar código para o e-mail da conta encontrada',
      description: 'Quando o claim devolve NEEDS_LINK. O código (4 dígitos, 10 min) vai SEMPRE para o e-mail da conta existente. Rate limit: 5/min. Rota pública.',
      body: { type: 'object', required: ['flowId', 'secret'], properties: flowAuthProps },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' }, maskedEmail: { type: 'string' }, status: { type: 'string' }, code: { type: 'string' } } },
      },
    },
  }, ctrl.sendLinkCode.bind(ctrl))

  fastify.post('/auth/social/link/code/verify', {
    config: limit(5),
    schema: {
      tags: ['auth'],
      summary: 'Vínculo: confirmar com o código e entrar',
      description: 'Código certo → conecta o Google à conta e devolve LOGGED_IN. Errado → 401 com `attemptsLeft`; senha + código somam no máximo 5 tentativas (429 e o fluxo acaba). Rate limit: 5/min. Rota pública.',
      body: {
        type: 'object',
        required: ['flowId', 'secret', 'deviceId', 'code'],
        properties: { ...flowAuthProps, ...deviceIdProp, code: { type: 'string', minLength: 4, maxLength: 4 } },
      },
      response: { 200: claimResponse },
    },
  }, ctrl.verifyLinkCode.bind(ctrl))

  fastify.post('/auth/social/link/password', {
    config: limit(10),
    schema: {
      tags: ['auth'],
      summary: 'Vínculo: confirmar com a senha da conta e entrar',
      description: 'Senha certa → conecta o Google e devolve LOGGED_IN. Errada → 401 com `attemptsLeft` (máximo 5 somando com o código). Rate limit: 10/min. Rota pública.',
      body: {
        type: 'object',
        required: ['flowId', 'secret', 'deviceId', 'password'],
        properties: { ...flowAuthProps, ...deviceIdProp, password: { type: 'string' } },
      },
      response: { 200: claimResponse },
    },
  }, ctrl.linkWithPassword.bind(ctrl))

  fastify.post('/auth/social/complete', {
    config: limit(10),
    schema: {
      tags: ['auth'],
      summary: 'Cadastro pelo Google ("Quase lá")',
      description: 'Quando o claim devolve NEEDS_SIGNUP. Cria o cliente (sem senha) já com o Google conectado e devolve LOGGED_IN. E-mail vem do Google; CPF/telefone repetidos → 409 com a mesma mensagem do /auth/register. Rate limit: 10/min. Rota pública.',
      body: {
        type: 'object',
        required: ['flowId', 'secret', 'deviceId', 'name', 'cpf', 'birthDate', 'phone', 'condominiumId', 'apartment'],
        properties: {
          ...flowAuthProps,
          ...deviceIdProp,
          name: { type: 'string', minLength: 2, description: 'Nome completo (vem do Google, editável).' },
          cpf: { type: 'string', description: 'CPF (com ou sem máscara) — validado com dígitos verificadores.' },
          birthDate: { type: 'string', description: 'Nascimento em ISO 8601.' },
          phone: { type: 'string', description: 'Celular (avisos de entrega).' },
          condominiumId: { type: 'string' },
          apartment: { type: 'string' },
          block: { type: 'string' },
          complement: { type: 'string', maxLength: 10 },
          // Sem maxLength/enum de propósito — quem descarta o valor ruim é o Zod (`.catch`), como no /auth/register.
          referralCode: { type: 'string' },
          referralSource: { type: 'string' },
        },
      },
      response: { 200: claimResponse },
    },
  }, ctrl.complete.bind(ctrl))

  fastify.get('/auth/social/accounts', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Contas conectadas do cliente (Perfil)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: { provider: { type: 'string' }, email: { type: 'string', nullable: true }, linkedAt: { type: 'string', format: 'date-time' } },
          },
        },
      },
    },
  }, ctrl.accounts.bind(ctrl))

  fastify.delete('/auth/social/:provider', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Desconectar o Google (Perfil)',
      description: 'Sempre permitido: o código no e-mail continua entrando. Idempotente.',
      security: [{ bearerAuth: [] }],
      params: providerParams,
      response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
    },
  }, ctrl.disconnect.bind(ctrl))
}
