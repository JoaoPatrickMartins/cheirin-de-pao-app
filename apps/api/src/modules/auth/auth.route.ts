import { FastifyPluginAsync } from 'fastify'
import { AuthController } from './auth.controller.js'

// OTP rate limit: 5 req/min por IP — protege contra brute force
const otpRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }

export const authRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AuthController(fastify)

  // Public routes — no preHandler
  fastify.post('/auth/register', {
    schema: {
      tags: ['auth'],
      summary: 'Cadastrar novo cliente',
      description: 'Registra um novo cliente no sistema em 5 passos. O CPF é validado com dígitos verificadores. E-mail e telefone são obrigatórios: o OTP de confirmação é enviado por e-mail (único canal neste momento) e o telefone fica registrado para os avisos de entrega e para o OTP por WhatsApp futuro. Após o cadastro, o cliente ainda precisa verificar o OTP para obter o JWT.',
      body: {
        type: 'object',
        required: ['name', 'cpf', 'birthDate', 'email', 'phone', 'password', 'condominiumId', 'apartment'],
        properties: {
          name: { type: 'string', minLength: 2, description: 'Nome completo do cliente (mínimo 2 caracteres).' },
          cpf: { type: 'string', minLength: 11, maxLength: 11, description: 'CPF sem pontuação (11 dígitos). Validado com dígitos verificadores.' },
          birthDate: { type: 'string', description: 'Data de nascimento em ISO 8601 (ex.: 2000-01-31T00:00:00.000Z). Validada como datetime pelo Zod.' },
          phone: { type: 'string', description: 'Telefone celular do cliente. Obrigatório (avisos de entrega e OTP por WhatsApp futuro).' },
          email: { type: 'string', format: 'email', description: 'E-mail do cliente. Obrigatório — canal de envio do OTP.' },
          password: { type: 'string', description: 'Senha de acesso (8–72 chars, com minúscula, maiúscula e número).' },
          condominiumId: { type: 'string', description: 'ID do condomínio onde o cliente mora (MongoDB ObjectId).' },
          apartment: { type: 'string', description: 'Número ou identificação do apartamento/unidade.' },
          block: { type: 'string', description: 'Bloco do apartamento. Obrigatório em condomínios do tipo BLOCKS.' },
        },
      },
      response: {
        201: {
          type: 'object',
          description: 'Usuário criado com sucesso. Use o userId para verificar o OTP.',
          properties: {
            userId: { type: 'string', description: 'ID do usuário criado (MongoDB ObjectId). Usar em /auth/otp/verify.' },
          },
        },
      },
    },
  }, ctrl.register.bind(ctrl))

  // Login por e-mail + senha (método primário). Rate limit próprio contra brute force.
  fastify.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      tags: ['auth'],
      summary: 'Login por e-mail e senha',
      description: 'Autentica por e-mail + senha e retorna o par access+refresh. Resposta genérica em caso de credenciais inválidas (anti-enumeração). Contas sem senha definida devem usar o OTP e definir a senha no primeiro acesso. Rate limit: 10 req/min por IP. Rota pública.',
      body: {
        type: 'object',
        required: ['email', 'password', 'deviceId'],
        properties: {
          email: { type: 'string', format: 'email', description: 'E-mail cadastrado.' },
          password: { type: 'string', description: 'Senha do usuário.' },
          deviceId: { type: 'string', description: 'UUID único do dispositivo (gerado pelo app na primeira instalação).' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Login bem-sucedido. Use o accessToken como Bearer e o refreshToken em /auth/refresh.',
          properties: {
            accessToken: { type: 'string', description: 'Access token JWT (vida curta, ~15 min).' },
            refreshToken: { type: 'string', description: 'Refresh token opaco (90 dias).' },
            hasPassword: { type: 'boolean', description: 'Sempre true no login por senha.' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, ctrl.login.bind(ctrl))

  fastify.post('/auth/otp/send', {
    ...otpRateLimit,
    schema: {
      tags: ['auth'],
      summary: 'Enviar OTP de verificação',
      description: 'Envia um código OTP de 4 dígitos para o e-mail do usuário. Rate limit: 5 requisições por minuto por IP para prevenir abuso. O OTP expira em 10 minutos. Rota pública.',
      body: {
        type: 'object',
        required: ['email'],
        description: 'Informe o e-mail do usuário — único canal de acesso neste momento.',
        properties: {
          email: { type: 'string', format: 'email', description: 'E-mail do usuário para receber o OTP.' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'OTP enviado com sucesso.',
          properties: {
            userId: { type: 'string', description: 'ID do usuário (MongoDB ObjectId). Usar em /auth/otp/verify.' },
            message: { type: 'string', description: 'Mensagem de confirmação do envio.' },
          },
        },
      },
    },
  }, ctrl.sendOtp.bind(ctrl))

  fastify.post('/auth/otp/verify', {
    ...otpRateLimit,
    schema: {
      tags: ['auth'],
      summary: 'Verificar OTP e obter tokens',
      description: 'Verifica o código OTP de 4 dígitos. Em caso de sucesso, retorna um access token JWT (curto) e um refresh token (90 dias). O OTP é método alternativo de login e de recuperação. Se `hasPassword` for false, o app deve forçar a definição de senha antes de prosseguir. Rate limit: 5 req/min por IP. Rota pública.',
      body: {
        type: 'object',
        required: ['userId', 'code', 'deviceId'],
        properties: {
          userId: { type: 'string', description: 'ID do usuário retornado em /auth/otp/send.' },
          code: { type: 'string', minLength: 4, maxLength: 4, description: 'Código OTP de 4 dígitos recebido por e-mail.' },
          deviceId: { type: 'string', description: 'UUID único do dispositivo (gerado pelo app na primeira instalação). Usado para associar sessões.' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'OTP válido. Use o accessToken como Bearer e o refreshToken em /auth/refresh.',
          properties: {
            accessToken: { type: 'string', description: 'Access token JWT (vida curta, ~15 min). Enviar como Authorization: Bearer.' },
            refreshToken: { type: 'string', description: 'Refresh token opaco (90 dias). Usar em POST /auth/refresh para renovar o acesso.' },
            hasPassword: { type: 'boolean', description: 'false = conta ainda sem senha; o app deve forçar a definição de senha.' },
            user: {
              type: 'object',
              description: 'Dados básicos do usuário autenticado.',
              properties: {
                id: { type: 'string', description: 'ID do usuário (MongoDB ObjectId).' },
                name: { type: 'string', description: 'Nome completo do usuário.' },
                role: { type: 'string', description: 'Role do usuário: CLIENT, COURIER ou ADMIN.' },
              },
            },
          },
        },
      },
    },
  }, ctrl.verifyOtp.bind(ctrl))

  // Renovação de sessão — troca o refresh token por um novo par (rotação). Rota pública.
  fastify.post('/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      tags: ['auth'],
      summary: 'Renovar tokens (refresh)',
      description: 'Troca um refresh token válido por um novo par access+refresh (o refresh antigo é revogado — rotação). Retorna 401 se o refresh estiver expirado, revogado ou de outro dispositivo. Rota pública.',
      body: {
        type: 'object',
        required: ['refreshToken', 'deviceId'],
        properties: {
          refreshToken: { type: 'string', description: 'Refresh token obtido no login/verify.' },
          deviceId: { type: 'string', description: 'UUID do dispositivo — deve bater com o do refresh token.' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Novo par de tokens.',
          properties: {
            accessToken: { type: 'string', description: 'Novo access token JWT.' },
            refreshToken: { type: 'string', description: 'Novo refresh token (o anterior foi revogado).' },
            hasPassword: { type: 'boolean', description: 'Indica se a conta já tem senha definida.' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, ctrl.refresh.bind(ctrl))

  // Logout — revoga a sessão (refresh) atual. Requer access token válido.
  fastify.post('/auth/logout', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Logout (revogar sessão)',
      description: 'Revoga o refresh token da sessão atual (identificada pelo claim do access token). Idempotente.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
        },
      },
    },
  }, ctrl.logout.bind(ctrl))

  // Definir senha no 1º acesso (autenticado). Só quando a conta ainda não tem senha.
  fastify.post('/auth/password/set', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Definir senha (1º acesso)',
      description: 'Define a senha do usuário autenticado. Permitido apenas quando a conta ainda não possui senha (fluxo de 1º acesso após login por OTP). A senha deve atender à política: 8–72 caracteres, com minúscula, maiúscula e número.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', description: 'Nova senha (8–72 chars, com minúscula, maiúscula e número).' },
        },
      },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    },
  }, ctrl.setPassword.bind(ctrl))

  // Recuperação de senha via OTP (público). Rate limit próprio.
  fastify.post('/auth/password/reset', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      tags: ['auth'],
      summary: 'Redefinir senha via OTP',
      description: 'Confirma o código OTP (obtido em /auth/otp/send) e define a nova senha atomicamente, retornando um novo par de tokens (o usuário fica logado). Política de senha: 8–72 chars, com minúscula, maiúscula e número. Rate limit: 5 req/min por IP. Rota pública.',
      body: {
        type: 'object',
        required: ['userId', 'code', 'deviceId', 'newPassword'],
        properties: {
          userId: { type: 'string', description: 'ID do usuário retornado em /auth/otp/send.' },
          code: { type: 'string', minLength: 4, maxLength: 4, description: 'Código OTP de 4 dígitos.' },
          deviceId: { type: 'string', description: 'UUID único do dispositivo.' },
          newPassword: { type: 'string', description: 'Nova senha (8–72 chars, com minúscula, maiúscula e número).' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            hasPassword: { type: 'boolean' },
            user: {
              type: 'object',
              properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' } },
            },
          },
        },
      },
    },
  }, ctrl.resetPassword.bind(ctrl))

  // Troca de senha logado (autenticado) — exige a senha atual.
  fastify.post('/auth/password/change', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth'],
      summary: 'Trocar senha (logado)',
      description: 'Troca a senha do usuário autenticado exigindo a senha atual. A nova senha deve atender à política: 8–72 caracteres, com minúscula, maiúscula e número.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', description: 'Senha atual.' },
          newPassword: { type: 'string', description: 'Nova senha (8–72 chars, com minúscula, maiúscula e número).' },
        },
      },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    },
  }, ctrl.changePassword.bind(ctrl))

  // Admin-only route — authenticate preHandler validates Bearer token
  fastify.post(
    '/auth/couriers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Cadastrar entregador (admin)',
        description: 'Cadastra um novo entregador no sistema. Restrito a administradores (role ADMIN). O entregador receberá um OTP por e-mail para acessar o app de entrega. O CPF deve ser único no sistema.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'cpf'],
          properties: {
            name: { type: 'string', description: 'Nome completo do entregador.' },
            cpf: { type: 'string', minLength: 11, maxLength: 11, description: 'CPF do entregador sem pontuação (11 dígitos).' },
            phone: { type: 'string', description: 'Telefone do entregador. Obrigatório se email não informado.' },
            email: { type: 'string', format: 'email', description: 'E-mail do entregador para receber o OTP de acesso. Obrigatório se phone não informado.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Entregador cadastrado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do entregador criado (MongoDB ObjectId).' },
              name: { type: 'string', description: 'Nome do entregador.' },
              role: { type: 'string', description: 'Role sempre "COURIER" para entregadores.' },
            },
          },
        },
      },
    },
    ctrl.registerCourier.bind(ctrl),
  )
}
