import { z } from 'zod'

/**
 * PaymentIdParamSchema — validação do parâmetro :id nas rotas de pagamento.
 * Sem body para refund (estorno total — D-04).
 */
export const PaymentIdParamSchema = z.object({
  id: z.string().min(1, 'ID do pagamento é obrigatório'),
})

export type PaymentIdParam = z.infer<typeof PaymentIdParamSchema>
