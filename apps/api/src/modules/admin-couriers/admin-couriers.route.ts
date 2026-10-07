import { FastifyPluginAsync } from 'fastify'
import { AdminCouriersController } from './admin-couriers.controller.js'

/**
 * adminCouriersRoute — registra rotas de gestão de entregadores pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller.
 *
 * Rotas registradas:
 *   GET  /admin/couriers                         — lista entregadores (cadastro completo do A3)
 *   POST /admin/couriers                         — cadastra entregador (gera o nº do crachá)
 *   POST /admin/couriers/photo                   — foto do crachá (multipart)
 *   PATCH /admin/couriers/:id/toggle             — ativa/desativa entregador (isBlocked)
 *   PATCH /admin/couriers/:id                    — atualiza dados (sem cpf)
 *   GET/POST /admin/couriers/:id/time-offs       — folgas (F-8)
 *   DELETE /admin/couriers/:id/time-offs/:tid
 *
 * O fast-json-stringify DESCARTA o que não estiver declarado nas respostas.
 */
const vehicleSchema = {
  type: 'object',
  nullable: true,
  description: 'Veículo: tipo MOTO | CARRO | BIKE | A_PE; combustível e consumo só para moto/carro.',
  properties: {
    tipo: { type: 'string' },
    modelo: { type: 'string', nullable: true },
    placa: { type: 'string', nullable: true },
    combustivel: { type: 'string', nullable: true, description: 'GASOLINA | ETANOL | FLEX | GNV (GNV só no carro; nele o consumo é km/m³).' },
    kmPorLitro: { type: 'number', nullable: true },
  },
}
const rulesSchema = {
  type: 'object',
  description: 'Permissões e regras (padrão: fotos obrigatórias, reordenar e recados desligados).',
  properties: {
    fotoEntrega: { type: 'boolean' },
    fotoNaoEntrega: { type: 'boolean' },
    podeReordenar: { type: 'boolean' },
    podeRecados: { type: 'boolean' },
  },
}
const paySchema = {
  type: 'object',
  nullable: true,
  description: 'Pagamento: PER_DELIVERY | PER_ROUTE | WEEKLY_FIXED (null = sem modalidade), valor e se paga o combustível.',
  properties: {
    modalidade: { type: 'string', nullable: true },
    valor: { type: 'number', nullable: true },
    pagaCombustivel: { type: 'boolean' },
  },
}
const availabilitySchema = {
  type: 'object',
  nullable: true,
  description: 'Dias (seg…dom) e turnos em que trabalha. null = todos.',
  properties: {
    dias: { type: 'array', items: { type: 'string' } },
    turnos: { type: 'array', items: { type: 'string' } },
  },
}
const courierView = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'ID do entregador (MongoDB ObjectId).' },
    name: { type: 'string' },
    cpf: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    isBlocked: { type: 'boolean', description: 'true = desativado (não entra na divisão; crachá inativo).' },
    createdAt: { type: 'string', description: 'Data de cadastro ("entregador desde").' },
    photoUrl: { type: 'string', nullable: true, description: 'Foto do crachá (pública).' },
    vehicle: vehicleSchema,
    rules: rulesSchema,
    pay: paySchema,
    availability: availabilitySchema,
    badgeNumber: { type: 'integer', nullable: true, description: 'Nº do crachá (sequencial).' },
    badgeValidUntil: { type: 'string', nullable: true, description: 'Último dia válido do crachá (YYYY-MM-DD).' },
    offToday: { type: 'string', nullable: true, description: 'FOLGA | FORA_DA_ESCALA hoje; null = trabalha.' },
    routeSuggestion: { type: 'boolean', description: 'Há sugestão de rota esperando o admin.' },
    terms: {
      type: 'object',
      description: 'Termo do Entregador Parceiro: última versão aceita e quando (null = nunca aceitou). Compare com a vigente (shared/legal.ts).',
      properties: { acceptedVersion: { type: 'string', nullable: true }, acceptedAt: { type: 'string', nullable: true } },
    },
  },
}
const courierBodyProps = {
  name: { type: 'string', description: 'Nome completo do entregador.' },
  phone: { type: 'string', description: 'Telefone.' },
  email: { type: 'string', format: 'email', description: 'E-mail.' },
  photoUrl: { type: 'string', nullable: true },
  vehicle: vehicleSchema,
  rules: rulesSchema,
  pay: paySchema,
  availability: availabilitySchema,
  badgeValidUntil: { type: 'string', nullable: true, description: 'Último dia válido do crachá (YYYY-MM-DD). Padrão no cadastro: 31/12 do ano.' },
}
const err = { type: 'object', properties: { error: { type: 'string' } } }
const timeOff = {
  type: 'object',
  properties: { id: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, reason: { type: 'string', nullable: true } },
}
const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'ID do entregador (MongoDB ObjectId).' } } }

export const adminCouriersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCouriersController(fastify)
  const tags = ['admin — couriers']
  const security = [{ bearerAuth: [] }]
  const pre = [fastify.authenticate]

  fastify.get(
    '/admin/couriers',
    {
      preHandler: pre,
      schema: {
        tags,
        security,
        summary: 'Listar entregadores (admin)',
        description: 'Cadastro completo de cada entregador (A3), mais "de folga hoje" e "sugestão de rota nova". Restrito a ADMIN.',
        response: { 200: { type: 'array', items: courierView } },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/couriers',
    {
      preHandler: pre,
      schema: {
        tags,
        security,
        summary: 'Cadastrar entregador (admin)',
        description: 'Cria o entregador (sem OTP) e gera o nº do crachá. Validade padrão do crachá: 31/12 do ano. 409 CPF duplicado. Restrito a ADMIN.',
        body: {
          type: 'object',
          required: ['name', 'cpf'],
          properties: { ...courierBodyProps, cpf: { type: 'string', minLength: 11, maxLength: 11, description: 'CPF sem pontuação (11 dígitos). Único.' } },
        },
        response: { 201: courierView },
      },
    },
    ctrl.create.bind(ctrl),
  )

  // Rotas estáticas ANTES das dinâmicas /:id
  fastify.post(
    '/admin/couriers/photo',
    {
      preHandler: pre,
      schema: {
        tags,
        security,
        summary: 'Foto do crachá (admin)',
        description: 'multipart/form-data com `file` (JPG/PNG/WebP, até 5 MB). Sobe na pasta pública `couriers/` e devolve a URL. 503 sem armazenamento configurado.',
        response: { 201: { type: 'object', properties: { url: { type: 'string' } } }, 400: err, 503: err },
      },
    },
    ctrl.uploadPhoto.bind(ctrl),
  )

  fastify.patch(
    '/admin/couriers/:id/toggle',
    {
      preHandler: pre,
      schema: {
        tags,
        security,
        summary: 'Ativar/bloquear entregador (admin)',
        params: idParams,
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID do entregador.' },
              name: { type: 'string', description: 'Nome do entregador.' },
              isBlocked: { type: 'boolean', description: 'Novo status de bloqueio após o toggle.' },
            },
          },
        },
      },
    },
    ctrl.toggle.bind(ctrl),
  )

  fastify.get(
    '/admin/couriers/:id/time-offs',
    {
      preHandler: pre,
      schema: { tags, security, summary: 'Folgas do entregador (em andamento e futuras)', params: idParams, response: { 200: { type: 'array', items: timeOff }, 404: err } },
    },
    ctrl.listTimeOffs.bind(ctrl),
  )

  fastify.post(
    '/admin/couriers/:id/time-offs',
    {
      preHandler: pre,
      schema: {
        tags,
        security,
        summary: 'Cadastrar folga',
        description: 'Grava a folga e devolve `overlaps`: dias/turnos com entregas já despachadas para o entregador (a divisão precisa ser refeita). Não bloqueia.',
        params: idParams,
        body: {
          type: 'object',
          required: ['startDate', 'endDate'],
          properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, reason: { type: 'string' } },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              timeOff,
              overlaps: {
                type: 'array',
                items: { type: 'object', properties: { date: { type: 'string' }, slotId: { type: 'string' }, slotLabel: { type: 'string' }, stops: { type: 'integer' } } },
              },
            },
          },
          400: err,
          404: err,
        },
      },
    },
    ctrl.addTimeOff.bind(ctrl),
  )

  fastify.delete(
    '/admin/couriers/:id/time-offs/:timeOffId',
    {
      preHandler: pre,
      schema: { tags, security, summary: 'Remover folga', response: { 204: { type: 'null' }, 404: err } },
    },
    ctrl.deleteTimeOff.bind(ctrl),
  )

  fastify.patch(
    '/admin/couriers/:id',
    {
      preHandler: pre,
      schema: {
        tags,
        security,
        summary: 'Atualizar dados do entregador (admin)',
        description: 'Atualiza o cadastro (A3). O CPF não pode ser alterado. Só os campos enviados mudam. Restrito a ADMIN.',
        params: idParams,
        body: { type: 'object', description: 'Campos parciais (CPF não pode ser alterado).', properties: courierBodyProps },
        response: { 200: courierView },
      },
    },
    ctrl.updateCourier.bind(ctrl),
  )
}
