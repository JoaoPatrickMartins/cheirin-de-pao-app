import { FastifyPluginAsync } from 'fastify'
import { AdminCondominiumsController } from './admin-condominiums.controller.js'

/**
 * adminCondominiumsRoute — rotas CRUD de condomínios para o admin.
 *
 * T-07-02-05: preHandler: [fastify.authenticate] garante JWT válido em todas as rotas.
 * T-07-02-01: Role check ADMIN fica inline no controller (per D-11).
 */
export const adminCondominiumsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCondominiumsController(fastify)

  fastify.get(
    '/admin/condominiums',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — condominiums'],
        summary: 'Listar condomínios (admin)',
        description: 'Retorna todos os condomínios cadastrados com dados completos incluindo endereço. Diferente da rota pública /condominiums, esta inclui campos administrativos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de todos os condomínios.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do condomínio (MongoDB ObjectId).' },
                name: { type: 'string', description: 'Nome do condomínio.' },
                type: { type: 'string', description: 'Tipo: SINGLE_ENTRANCE (entrada única) ou BLOCKS (por blocos).' },
                address: {
                  type: 'object',
                  description: 'Endereço completo do condomínio.',
                  properties: {
                    street: { type: 'string', description: 'Logradouro.' },
                    number: { type: 'string', description: 'Número.' },
                    complement: { type: 'string', description: 'Complemento (opcional).' },
                    city: { type: 'string', description: 'Cidade.' },
                    state: { type: 'string', description: 'Estado (sigla UF).' },
                    zip: { type: 'string', description: 'CEP.' },
                  },
                },
                createdAt: { type: 'string', description: 'Data de criação.' },
              },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/condominiums',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — condominiums'],
        summary: 'Criar condomínio (admin)',
        description: 'Cadastra um novo condomínio no sistema. Condomínios do tipo BLOCKS permitem que clientes informem bloco e apartamento. Condomínios do tipo SINGLE_ENTRANCE têm apenas apartamento. O endereço é usado para otimização de rotas no módulo do entregador (OSRM).',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'type', 'address'],
          properties: {
            name: { type: 'string', description: 'Nome do condomínio (ex: Residencial das Palmeiras).' },
            type: { type: 'string', enum: ['SINGLE_ENTRANCE', 'BLOCKS'], description: 'SINGLE_ENTRANCE: uma entrada para todos. BLOCKS: dividido por blocos — clientes devem informar o bloco.' },
            address: {
              type: 'object',
              required: ['street', 'number', 'city', 'state', 'zip'],
              description: 'Endereço completo para roteamento OSRM.',
              properties: {
                street: { type: 'string', description: 'Logradouro (rua, avenida, etc.).' },
                number: { type: 'string', description: 'Número do endereço.' },
                complement: { type: 'string', description: 'Complemento opcional (ex: portaria 2).' },
                city: { type: 'string', description: 'Cidade.' },
                state: { type: 'string', description: 'Estado (sigla UF, ex: SP).' },
                zip: { type: 'string', description: 'CEP (8 dígitos sem hífen).' },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Condomínio criado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do condomínio criado.' },
              name: { type: 'string', description: 'Nome do condomínio.' },
              type: { type: 'string', description: 'Tipo do condomínio.' },
            },
          },
        },
      },
    },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/condominiums/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — condominiums'],
        summary: 'Atualizar condomínio (admin)',
        description: 'Atualiza campos parciais de um condomínio existente. Apenas os campos enviados são modificados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do condomínio a atualizar (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          description: 'Campos parciais a atualizar.',
          properties: {
            name: { type: 'string', description: 'Novo nome do condomínio.' },
            type: { type: 'string', enum: ['SINGLE_ENTRANCE', 'BLOCKS'], description: 'Novo tipo de condomínio.' },
            address: {
              type: 'object',
              description: 'Endereço parcialmente atualizado.',
              properties: {
                street: { type: 'string', description: 'Novo logradouro.' },
                number: { type: 'string', description: 'Novo número.' },
                complement: { type: 'string', description: 'Novo complemento.' },
                city: { type: 'string', description: 'Nova cidade.' },
                state: { type: 'string', description: 'Nova UF.' },
                zip: { type: 'string', description: 'Novo CEP.' },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Condomínio atualizado.',
            properties: {
              id: { type: 'string', description: 'ID do condomínio.' },
              name: { type: 'string', description: 'Nome atualizado.' },
            },
          },
        },
      },
    },
    ctrl.update.bind(ctrl),
  )

  fastify.delete(
    '/admin/condominiums/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — condominiums'],
        summary: 'Remover condomínio (admin)',
        description: 'Remove um condomínio do sistema. Atenção: só é possível remover condomínios sem clientes ou pedidos ativos. Retorna 409 se houver clientes associados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do condomínio a remover (MongoDB ObjectId).' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'Condomínio removido com sucesso (sem corpo na resposta).',
          },
        },
      },
    },
    ctrl.remove.bind(ctrl),
  )
}
