import { FastifyPluginAsync } from 'fastify'
import { AdminCouriersController } from './admin-couriers.controller.js'

/**
 * adminCouriersRoute — registra rotas de gestão de entregadores pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller.
 *
 * Rotas registradas:
 *   GET  /admin/couriers              — lista entregadores
 *   POST /admin/couriers              — cadastra entregador
 *   PATCH /admin/couriers/:id/toggle  — ativa/desativa entregador (isBlocked)
 *   PATCH /admin/couriers/:id         — atualiza dados (sem cpf)
 */
export const adminCouriersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCouriersController(fastify)

  fastify.get(
    '/admin/couriers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — couriers'],
        summary: 'Listar entregadores (admin)',
        description: 'Retorna todos os entregadores cadastrados, incluindo bloqueados. Exibe status de bloqueio e dados de contato. Entregadores bloqueados não recebem novas atribuições de pedidos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de entregadores.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do entregador (MongoDB ObjectId).' },
                name: { type: 'string', description: 'Nome completo do entregador.' },
                cpf: { type: 'string', description: 'CPF do entregador (11 dígitos).' },
                phone: { type: 'string', description: 'Telefone do entregador.' },
                email: { type: 'string', description: 'E-mail do entregador.' },
                isBlocked: { type: 'boolean', description: 'true se o entregador está bloqueado e não pode realizar entregas.' },
                createdAt: { type: 'string', description: 'Data de cadastro.' },
              },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/couriers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — couriers'],
        summary: 'Cadastrar entregador (admin)',
        description: 'Cadastra um novo entregador no sistema com role=COURIER. O CPF deve ser único. O entregador usa o app de entrega com autenticação OTP pelo phone ou email informado. Entregadores cadastrados aqui recebem o mesmo fluxo de OTP que clientes.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'cpf'],
          properties: {
            name: { type: 'string', description: 'Nome completo do entregador.' },
            cpf: { type: 'string', minLength: 11, maxLength: 11, description: 'CPF do entregador sem pontuação (11 dígitos). Deve ser único.' },
            phone: { type: 'string', description: 'Telefone do entregador para OTP via SMS. Obrigatório se email não informado.' },
            email: { type: 'string', format: 'email', description: 'E-mail do entregador para OTP. Obrigatório se phone não informado.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Entregador criado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do entregador criado.' },
              name: { type: 'string', description: 'Nome do entregador.' },
              role: { type: 'string', description: 'Role sempre "COURIER".' },
              cpf: { type: 'string', nullable: true, description: 'CPF do entregador.' },
              phone: { type: 'string', nullable: true, description: 'Telefone.' },
              email: { type: 'string', nullable: true, description: 'E-mail.' },
              isBlocked: { type: 'boolean', description: 'Status de bloqueio.' },
              createdAt: { type: 'string', description: 'Data de cadastro.' },
            },
          },
        },
      },
    },
    ctrl.create.bind(ctrl),
  )

  // IMPORTANTE: rota estática /toggle deve ficar ANTES da rota dinâmica /:id
  fastify.patch(
    '/admin/couriers/:id/toggle',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — couriers'],
        summary: 'Ativar/bloquear entregador (admin)',
        description: 'Alterna o status de bloqueio do entregador (toggle). Se isBlocked=false, passa para true e vice-versa. Entregadores bloqueados são removidos de sugestões de divisão e não recebem novas atribuições. Pedidos já atribuídos a um entregador bloqueado não são afetados automaticamente.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do entregador (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Status de bloqueio alternado.',
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

  fastify.patch(
    '/admin/couriers/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — couriers'],
        summary: 'Atualizar dados do entregador (admin)',
        description: 'Atualiza nome, telefone ou e-mail de um entregador. O CPF não pode ser alterado após o cadastro. Apenas os campos enviados são modificados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do entregador a atualizar (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          description: 'Campos parciais a atualizar (CPF não pode ser alterado).',
          properties: {
            name: { type: 'string', description: 'Novo nome do entregador.' },
            phone: { type: 'string', description: 'Novo telefone.' },
            email: { type: 'string', format: 'email', description: 'Novo e-mail.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Entregador atualizado.',
            properties: {
              id: { type: 'string', description: 'ID do entregador.' },
              name: { type: 'string', description: 'Nome atualizado.' },
              cpf: { type: 'string', nullable: true, description: 'CPF do entregador.' },
              phone: { type: 'string', nullable: true, description: 'Telefone.' },
              email: { type: 'string', nullable: true, description: 'E-mail.' },
              isBlocked: { type: 'boolean', description: 'Status de bloqueio.' },
              role: { type: 'string', description: 'Role do entregador.' },
              createdAt: { type: 'string', description: 'Data de cadastro.' },
            },
          },
        },
      },
    },
    ctrl.updateCourier.bind(ctrl),
  )
}
