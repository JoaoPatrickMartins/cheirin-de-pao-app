import { FastifyInstance } from 'fastify'
import { OrdersService } from '../orders/orders.service.js'

/**
 * Intenção de um Pedido único que pagou a diferença via Pix, carregada na metadata do
 * pagamento no Mercado Pago (chaves snake_case — o MP normaliza metadata para snake_case).
 * Retorna null quando o pagamento não é de um pedido único (ex.: compra de crédito comum).
 */
function readOrderIntent(
  metadata: unknown,
): { quantity: number; scheduledDate: string; deliveryTime?: string } | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  const quantity = Number(m.order_quantity)
  const scheduledDate = typeof m.order_scheduled_date === 'string' ? m.order_scheduled_date : ''
  if (!Number.isInteger(quantity) || quantity < 1) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return null
  const deliveryTime = typeof m.order_delivery_time === 'string' ? m.order_delivery_time : undefined
  return { quantity, scheduledDate, deliveryTime }
}

/**
 * Cria a Order de um Pedido único no SERVIDOR quando o Pix da diferença é aprovado — para
 * funcionar mesmo com o app fechado (o frontend só cria a Order quando está na tela do Pix).
 *
 * A intenção do pedido viaja na metadata do pagamento no MP (gravada em createPix). Chamado
 * pelo webhook do MP e pela reconciliação por pull (getStatus), sempre APÓS o crédito.
 *
 * Idempotente por paymentId: OrdersService.createSingleOrder devolve o pedido existente se já
 * houver um para este pagamento (e o índice único cobre corridas). NUNCA lança: se a criação
 * falhar (corte vencido, saldo insuficiente, etc.), apenas loga — os créditos já estão na conta
 * e o cliente pode reprogramar o pedido.
 */
export async function fulfillSingleOrderFromMetadata(
  fastify: FastifyInstance,
  payment: { id: string; userId: string },
  metadata: unknown,
): Promise<void> {
  const intent = readOrderIntent(metadata)
  if (!intent) return
  try {
    await new OrdersService(fastify).createSingleOrder(payment.userId, {
      quantity: intent.quantity,
      scheduledDate: intent.scheduledDate,
      ...(intent.deliveryTime ? { deliveryTime: intent.deliveryTime } : {}),
      paymentId: payment.id,
    })
  } catch (err) {
    fastify.log.warn(
      { err, paymentId: payment.id },
      '[pedido-unico] falha ao criar pedido pós-pagamento — créditos mantidos, cliente pode reprogramar',
    )
  }
}
