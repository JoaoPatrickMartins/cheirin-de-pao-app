import { FastifyPluginAsync } from 'fastify'
import { PaymentsController } from './payments.controller.js'

export const paymentsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new PaymentsController(fastify)

  fastify.post(
    '/payments/pix',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Criar pagamento Pix',
        description: 'Cria um pagamento via Pix no Stripe. Retorna o QR Code para exibição ao cliente. O cliente aguarda a confirmação via webhook do Stripe. Os créditos são adicionados automaticamente APENAS após o webhook "approved" do Stripe — nunca antes. Informe comboId OU customQuantity, nunca ambos.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          description: 'Informe comboId OU customQuantity — mutuamente exclusivos.',
          properties: {
            comboId: { type: 'string', description: 'ID do combo a comprar (ex: MongoDB ObjectId do combo). Preço por unidade é mais barato que avulso. Mutuamente exclusivo com customQuantity.' },
            customQuantity: { type: 'integer', minimum: 1, description: 'Quantidade avulsa de pãezinhos. Preço unitário maior que o do combo. Mutuamente exclusivo com comboId.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Pagamento Pix criado. Exiba o QR/copia-e-cola ao cliente; crédito ocorre via webhook do Stripe.',
            properties: {
              paymentId: { type: 'string', description: 'ID interno do pagamento (MongoDB ObjectId). Usar em /payments/:id/status.' },
              status: { type: 'string', description: 'Status inicial: "pending" até o webhook do Stripe confirmar.' },
              pixCopyPaste: { type: 'string', description: 'Código Pix copia-e-cola (EMV).' },
              pixQrCodeUrl: { type: 'string', description: 'Imagem do QR Code como data-URI base64 (Mercado Pago).' },
              expiresAt: { type: 'string', nullable: true, description: 'Expiração do QR (ISO 8601), ou null.' },
            },
          },
        },
      },
    },
    ctrl.createPix.bind(ctrl),
  )

  fastify.post(
    '/payments/card',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Criar pagamento por cartão (Stripe)',
        description: 'Dois fluxos: (1) savedCardId → cobrança off_session SEM CVV no cartão salvo (1 toque / recarga), aprovação síncrona; (2) sem savedCardId → cria um PaymentIntent e devolve clientSecret para o front confirmar via Stripe Elements. Informe comboId OU customQuantity.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          // Validação real (comboId OU customQuantity) é feita pela camada Zod no controller.
          properties: {
            savedCardId: { type: 'string', description: 'ID de um cartão salvo do cliente → cobrança off_session sem CVV. Se ausente, cria PaymentIntent para cartão novo.' },
            saveCard: { type: 'boolean', description: 'No fluxo de cartão novo, marca o cartão para uso futuro (off_session).' },
            comboId: { type: 'string', description: 'ID do combo a comprar. Mutuamente exclusivo com customQuantity.' },
            customQuantity: { type: 'integer', minimum: 1, description: 'Quantidade avulsa de pãezinhos. Mutuamente exclusivo com comboId.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Cartão salvo: status "approved"/"pending". Cartão novo: devolve clientSecret para confirmar no front.',
            properties: {
              paymentId: { type: 'string', description: 'ID interno do pagamento (MongoDB ObjectId).' },
              status: { type: 'string', description: 'Status: "approved" (créditos adicionados) ou "pending".' },
              clientSecret: { type: 'string', description: 'Apenas no fluxo de cartão novo: usar com Stripe Elements para confirmar o PaymentIntent.' },
            },
          },
        },
      },
    },
    ctrl.createCard.bind(ctrl),
  )

  fastify.get(
    '/payments/:id/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Consultar status de pagamento',
        description: 'Consulta o status atual de um pagamento pelo ID interno. Útil para polling enquanto aguarda confirmação do Pix. O cliente deve ser o dono do pagamento — retorna 403 se tentar acessar pagamento de outro usuário.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID interno do pagamento (MongoDB ObjectId) retornado em /payments/pix ou /payments/card.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Status atual do pagamento.',
            properties: {
              paymentId: { type: 'string', description: 'ID interno do pagamento.' },
              status: { type: 'string', description: 'Status atual: "pending", "approved", "rejected", "cancelled", "refunded".' },
              amount: { type: 'number', description: 'Valor total do pagamento em reais.' },
              createdAt: { type: 'string', description: 'Data/hora de criação do pagamento (ISO 8601).' },
            },
          },
        },
      },
    },
    ctrl.getStatus.bind(ctrl),
  )
}
