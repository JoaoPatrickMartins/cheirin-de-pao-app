/**
 * finalizePendingOrder — cria o pedido único após o pagamento da diferença.
 *
 * Usado pelas telas de pagamento (Pix e Cartão) quando o cliente paga na hora a
 * quantidade que falta no Pedido único. O saldo já foi creditado antes do pagamento
 * ser dado como aprovado — o cartão off_session credita antes de retornar 'approved'
 * e o webhook do Pix credita antes de marcar PAID — então POST /orders enxerga os
 * créditos recém-comprados e os reserva para a entrega.
 */
import { apiFetch } from './apiFetch'

export interface PendingOrder {
  /** Quantidade total do pedido (saldo + diferença comprada). */
  quantity: number
  /** Data de entrega no formato AAAA-MM-DD. */
  scheduledDate: string
  /** Horário do slot de entrega escolhido ("HH:MM"), quando o condomínio tem slots. */
  deliveryTime?: string
}

export interface FinalizeResult {
  ok: boolean
  creditBalance?: number
  message?: string
}

const FAIL_MESSAGE =
  'Pagamento recebido, mas não foi possível agendar. Seus créditos estão na conta — tente o Pedido único de novo.'

export async function finalizePendingOrder(order: PendingOrder): Promise<FinalizeResult> {
  try {
    const res = await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({
        quantity: order.quantity,
        scheduledDate: order.scheduledDate,
        ...(order.deliveryTime ? { deliveryTime: order.deliveryTime } : {}),
      }),
    })
    if (res.status === 201) {
      const data = (await res.json()) as { creditBalance?: number }
      return { ok: true, creditBalance: data.creditBalance }
    }
    return { ok: false, message: FAIL_MESSAGE }
  } catch {
    return { ok: false, message: FAIL_MESSAGE }
  }
}
