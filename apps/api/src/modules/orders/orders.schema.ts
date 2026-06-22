import { z } from 'zod'

/**
 * Schema de validação para criação de pedido avulso.
 * SCHED-01 — Pedido único com reserva atômica de créditos.
 *
 * Threat register:
 * - T-04-03-03: quantity validado como int 1..20 (Zod impede adulteração)
 * - T-04-03-02: scheduledDate validado como string datetime (formato ISO)
 */
export const CreateOrderSchema = z.object({
  quantity: z
    .number()
    .int('Quantidade deve ser inteiro')
    .min(1, 'Mínimo de 1 pão')
    .max(20, 'Máximo de 20 pães por pedido'),
  // Data-only "YYYY-MM-DD" — alinhado ao schema da rota (format: date) e ao que o
  // frontend (DateChips) envia. O `.datetime()` anterior rejeitava o formato real → avulso quebrado.
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de entrega deve estar no formato AAAA-MM-DD' }),
})

export type CreateOrderBody = z.infer<typeof CreateOrderSchema>
