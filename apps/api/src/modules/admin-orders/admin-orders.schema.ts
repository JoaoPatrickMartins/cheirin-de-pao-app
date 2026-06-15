import { z } from 'zod'

/**
 * Schema de validação para atualização de status de pedido pelo Admin.
 * T-05-01: Apenas ADMIN pode mudar status — role check no controller.
 * T-05-02: Apenas transições OUT_FOR_DELIVERY e DELIVERED são aceitas pelo schema.
 *
 * Transições válidas do negócio:
 *   SCHEDULED → OUT_FOR_DELIVERY
 *   OUT_FOR_DELIVERY → DELIVERED
 *
 * O schema valida que apenas valores finais chegam ao service.
 * A validação da transição em si (VALID_TRANSITIONS) ocorre no service.
 */
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['OUT_FOR_DELIVERY', 'DELIVERED'], {
    errorMap: () => ({ message: 'Status inválido. Use OUT_FOR_DELIVERY ou DELIVERED.' }),
  }),
})

export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusSchema>
