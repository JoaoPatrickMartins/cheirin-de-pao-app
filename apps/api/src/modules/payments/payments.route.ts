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
        description: 'Cria um pagamento via Pix no Mercado Pago. Retorna o QR Code para exibição ao cliente. O cliente aguarda a confirmação via webhook do MP. Os créditos são adicionados automaticamente APENAS após o webhook "approved" do Mercado Pago — nunca antes. Informe comboId OU customQuantity, nunca ambos.',
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
            description: 'Pagamento Pix criado. Exiba o qrCode ao cliente para que ele efetue o pagamento.',
            properties: {
              paymentId: { type: 'string', description: 'ID interno do pagamento (MongoDB ObjectId). Usar em /payments/:id/status.' },
              status: { type: 'string', description: 'Status inicial do pagamento: sempre "pending" para Pix até webhook confirmar.' },
              qrCode: { type: 'string', description: 'String do QR Code Pix no padrão EMV. Renderizar com biblioteca de QR Code no frontend.' },
              qrCodeBase64: { type: 'string', description: 'QR Code em formato Base64 para exibição direta como imagem.' },
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
        summary: 'Criar pagamento por cartão',
        description: 'Cria um pagamento via cartão de crédito/débito usando o Mercado Pago Bricks. O token do cartão deve ser gerado pelo MP Bricks no frontend — nunca enviar dados brutos do cartão. O status pode ser "approved" imediatamente ou "pending" para análise antifraude. Créditos são adicionados apenas quando status = "approved".',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['token', 'installments', 'issuerId', 'paymentMethodId', 'payerEmail', 'payerIdentification'],
          properties: {
            token: { type: 'string', description: 'Token único do cartão gerado pelo Mercado Pago Bricks no frontend. Válido por uso único.' },
            installments: { type: 'integer', minimum: 1, description: 'Número de parcelas (1 a 12).' },
            issuerId: { type: 'string', description: 'ID da bandeira/emissor do cartão retornado pelo MP Bricks.' },
            paymentMethodId: { type: 'string', description: 'Método de pagamento (ex: visa, mastercard, pix). Retornado pelo MP Bricks.' },
            payerEmail: { type: 'string', format: 'email', description: 'E-mail do pagador para confirmação pelo MP.' },
            payerIdentification: {
              type: 'object',
              description: 'Documento de identificação do pagador.',
              properties: {
                type: { type: 'string', description: 'Tipo do documento (CPF ou CNPJ).' },
                number: { type: 'string', description: 'Número do documento sem pontuação.' },
              },
            },
            comboId: { type: 'string', description: 'ID do combo a comprar. Mutuamente exclusivo com customQuantity.' },
            customQuantity: { type: 'integer', minimum: 1, description: 'Quantidade avulsa de pãezinhos. Mutuamente exclusivo com comboId.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Pagamento por cartão criado. Verifique o status para saber se foi aprovado imediatamente.',
            properties: {
              paymentId: { type: 'string', description: 'ID interno do pagamento (MongoDB ObjectId).' },
              status: { type: 'string', description: 'Status do pagamento: "approved" (créditos já adicionados), "pending" (em análise), "rejected" (recusado).' },
              mpPaymentId: { type: 'string', description: 'ID do pagamento no Mercado Pago para referência.' },
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
