import { FastifyPluginAsync } from 'fastify'
import { AdminSuppliersController } from './admin-suppliers.controller.js'

/**
 * adminSuppliersRoute — registra rotas de CRUD de fornecedores pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller.
 *
 * Rotas registradas:
 *   GET  /admin/suppliers        — lista todos os fornecedores
 *   POST /admin/suppliers        — cria novo fornecedor
 *   PATCH /admin/suppliers/:id   — atualiza parcialmente
 *   DELETE /admin/suppliers/:id  — remove
 */
export const adminSuppliersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSuppliersController(fastify)

  fastify.get(
    '/admin/suppliers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — suppliers'],
        summary: 'Listar fornecedores (admin)',
        description: 'Retorna todos os fornecedores cadastrados com dados completos. O fornecedor principal (isPrincipal=true) é usado como padrão para pedidos ao fornecedor. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de fornecedores.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do fornecedor (MongoDB ObjectId).' },
                name: { type: 'string', description: 'Nome da empresa fornecedora.' },
                cnpj: { type: 'string', description: 'CNPJ do fornecedor (14 dígitos sem formatação).' },
                phone: { type: 'string', nullable: true, description: 'Telefone de contato.' },
                email: { type: 'string', nullable: true, description: 'E-mail de contato.' },
                pricePerUnit: { type: 'number', description: 'Preço por unidade de pão cobrado pelo fornecedor.' },
                isPrincipal: { type: 'boolean', description: 'true se é o fornecedor principal (padrão para pedidos).' },
                isActive: { type: 'boolean', description: 'Se o fornecedor está ativo.' },
                address: {
                  type: 'object',
                  description: 'Endereço do fornecedor.',
                  properties: {
                    street: { type: 'string', description: 'Logradouro.' },
                    number: { type: 'string', description: 'Número.' },
                    complement: { type: 'string', nullable: true, description: 'Complemento.' },
                    city: { type: 'string', description: 'Cidade.' },
                    state: { type: 'string', description: 'UF.' },
                    zip: { type: 'string', description: 'CEP.' },
                  },
                },
                createdAt: { type: 'string', description: 'Data de cadastro.' },
                updatedAt: { type: 'string', description: 'Data da última atualização.' },
              },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/suppliers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — suppliers'],
        summary: 'Criar fornecedor (admin)',
        description: 'Cadastra um novo fornecedor de pãezinhos. O pricePerUnit é o custo unitário do pão pago pela panificadora ao fornecedor. Se isPrincipal=true, este fornecedor passa a ser o padrão para novos pedidos (apenas um pode ser principal por vez). O CNPJ deve ser único no sistema.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'cnpj', 'pricePerUnit'],
          properties: {
            name: { type: 'string', description: 'Nome da empresa fornecedora.' },
            cnpj: { type: 'string', minLength: 14, maxLength: 14, description: 'CNPJ sem formatação (14 dígitos). Deve ser único no sistema.' },
            phone: { type: 'string', description: 'Telefone de contato do fornecedor.' },
            email: { type: 'string', format: 'email', description: 'E-mail de contato do fornecedor.' },
            pricePerUnit: { type: 'number', minimum: 0.01, description: 'Preço unitário do pão cobrado pelo fornecedor em reais.' },
            isPrincipal: { type: 'boolean', description: 'Se true, define como fornecedor principal (substitui o atual principal).' },
            address: {
              type: 'object',
              description: 'Endereço da empresa fornecedora.',
              properties: {
                street: { type: 'string', description: 'Logradouro.' },
                number: { type: 'string', description: 'Número.' },
                complement: { type: 'string', description: 'Complemento (opcional).' },
                city: { type: 'string', description: 'Cidade.' },
                state: { type: 'string', description: 'UF.' },
                zip: { type: 'string', description: 'CEP.' },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Fornecedor criado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do fornecedor criado.' },
              name: { type: 'string', description: 'Nome do fornecedor.' },
              cnpj: { type: 'string', description: 'CNPJ do fornecedor.' },
              phone: { type: 'string', nullable: true, description: 'Telefone de contato.' },
              email: { type: 'string', nullable: true, description: 'E-mail de contato.' },
              pricePerUnit: { type: 'number', description: 'Preço por unidade.' },
              isPrincipal: { type: 'boolean', description: 'Se é o fornecedor principal.' },
              isActive: { type: 'boolean', description: 'Se o fornecedor está ativo.' },
              address: {
                type: 'object',
                description: 'Endereço do fornecedor.',
                properties: {
                  street: { type: 'string', description: 'Logradouro.' },
                  number: { type: 'string', description: 'Número.' },
                  complement: { type: 'string', nullable: true, description: 'Complemento.' },
                  city: { type: 'string', description: 'Cidade.' },
                  state: { type: 'string', description: 'UF.' },
                  zip: { type: 'string', description: 'CEP.' },
                },
              },
              createdAt: { type: 'string', description: 'Data de cadastro.' },
            },
          },
        },
      },
    },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/suppliers/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — suppliers'],
        summary: 'Atualizar fornecedor (admin)',
        description: 'Atualiza campos parciais de um fornecedor. Apenas os campos enviados são modificados. Para mudar o fornecedor principal, use isPrincipal=true no novo fornecedor. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do fornecedor a atualizar (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          description: 'Campos parciais a atualizar.',
          properties: {
            name: { type: 'string', description: 'Novo nome.' },
            phone: { type: 'string', description: 'Novo telefone.' },
            email: { type: 'string', format: 'email', description: 'Novo e-mail.' },
            pricePerUnit: { type: 'number', minimum: 0.01, description: 'Novo preço unitário.' },
            isPrincipal: { type: 'boolean', description: 'Definir como fornecedor principal.' },
            address: { type: 'object', description: 'Novo endereço parcial.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Fornecedor atualizado.',
            properties: {
              id: { type: 'string', description: 'ID do fornecedor.' },
              name: { type: 'string', description: 'Nome atualizado.' },
              cnpj: { type: 'string', description: 'CNPJ do fornecedor.' },
              phone: { type: 'string', nullable: true, description: 'Telefone de contato.' },
              email: { type: 'string', nullable: true, description: 'E-mail de contato.' },
              pricePerUnit: { type: 'number', description: 'Preço por unidade.' },
              isPrincipal: { type: 'boolean', description: 'Se é o fornecedor principal.' },
              isActive: { type: 'boolean', description: 'Se o fornecedor está ativo.' },
              address: {
                type: 'object',
                description: 'Endereço do fornecedor.',
                properties: {
                  street: { type: 'string', description: 'Logradouro.' },
                  number: { type: 'string', description: 'Número.' },
                  complement: { type: 'string', nullable: true, description: 'Complemento.' },
                  city: { type: 'string', description: 'Cidade.' },
                  state: { type: 'string', description: 'UF.' },
                  zip: { type: 'string', description: 'CEP.' },
                },
              },
              createdAt: { type: 'string', description: 'Data de cadastro.' },
            },
          },
        },
      },
    },
    ctrl.update.bind(ctrl),
  )

  fastify.delete(
    '/admin/suppliers/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — suppliers'],
        summary: 'Remover fornecedor (admin)',
        description: 'Remove um fornecedor do sistema. Não é possível remover o fornecedor principal enquanto houver pedidos ativos. Retorna 409 se houver histórico de pedidos associado. Retorna 204 sem corpo na resposta. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do fornecedor a remover (MongoDB ObjectId).' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'Fornecedor removido com sucesso (sem corpo na resposta).',
          },
        },
      },
    },
    ctrl.remove.bind(ctrl),
  )
}
