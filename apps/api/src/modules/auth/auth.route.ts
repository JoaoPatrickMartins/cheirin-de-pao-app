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
      description: 'Registra um novo cliente no sistema em 5 passos. O CPF é validado com dígitos verificadores. Pelo menos um contato (phone ou email) é obrigatório. O campo channel define por qual canal o OTP será enviado para confirmar a identidade. Após o cadastro, o cliente ainda precisa verificar o OTP para obter o JWT.',
      body: {
        type: 'object',
        required: ['name', 'cpf', 'birthDate', 'channel', 'condominiumId', 'apartment'],
        properties: {
          name: { type: 'string', minLength: 2, description: 'Nome completo do cliente (mínimo 2 caracteres).' },
          cpf: { type: 'string', minLength: 11, maxLength: 11, description: 'CPF sem pontuação (11 dígitos). Validado com dígitos verificadores.' },
          birthDate: { type: 'string', format: 'date', description: 'Data de nascimento no formato ISO (YYYY-MM-DD).' },
          phone: { type: 'string', description: 'Telefone celular do cliente. Obrigatório se email não informado.' },
          email: { type: 'string', format: 'email', description: 'E-mail do cliente. Obrigatório se phone não informado.' },
          channel: { type: 'string', enum: ['sms', 'email'], description: 'Canal de envio do OTP: "sms" (via celular) ou "email". Deve corresponder ao contato informado.' },
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

  fastify.post('/auth/otp/send', {
    ...otpRateLimit,
    schema: {
      tags: ['auth'],
      summary: 'Enviar OTP de verificação',
      description: 'Envia um código OTP de 4 dígitos para o phone ou email do usuário. Rate limit: 5 requisições por minuto por IP para prevenir abuso. O OTP expira em 10 minutos. Rota pública.',
      body: {
        type: 'object',
        description: 'Informe phone OU email — o campo usado deve corresponder ao canal configurado no cadastro.',
        properties: {
          phone: { type: 'string', description: 'Telefone celular do usuário para receber o OTP via SMS.' },
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
      summary: 'Verificar OTP e obter JWT',
      description: 'Verifica o código OTP de 4 dígitos enviado ao cliente. Em caso de sucesso, retorna um JWT de acesso. Rate limit: 5 requisições por minuto por IP. O deviceId é um UUID único do dispositivo — associado ao token para auditoria de sessões. Rota pública.',
      body: {
        type: 'object',
        required: ['userId', 'code', 'deviceId'],
        properties: {
          userId: { type: 'string', description: 'ID do usuário retornado em /auth/otp/send.' },
          code: { type: 'string', minLength: 4, maxLength: 4, description: 'Código OTP de 4 dígitos recebido via SMS ou e-mail.' },
          deviceId: { type: 'string', description: 'UUID único do dispositivo (gerado pelo app na primeira instalação). Usado para associar sessões.' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'OTP válido. Token JWT para uso no header Authorization: Bearer {token}.',
          properties: {
            token: { type: 'string', description: 'JWT de acesso. Incluir em todas as requisições autenticadas como Bearer token.' },
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

  // Admin-only route — authenticate preHandler validates Bearer token
  fastify.post(
    '/auth/couriers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Cadastrar entregador (admin)',
        description: 'Cadastra um novo entregador no sistema. Restrito a administradores (role ADMIN). O entregador receberá um OTP pelo canal informado para acessar o app de entrega. O CPF deve ser único no sistema.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'cpf'],
          properties: {
            name: { type: 'string', description: 'Nome completo do entregador.' },
            cpf: { type: 'string', minLength: 11, maxLength: 11, description: 'CPF do entregador sem pontuação (11 dígitos).' },
            phone: { type: 'string', description: 'Telefone do entregador para receber OTP via SMS. Obrigatório se email não informado.' },
            email: { type: 'string', format: 'email', description: 'E-mail do entregador para receber OTP. Obrigatório se phone não informado.' },
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
