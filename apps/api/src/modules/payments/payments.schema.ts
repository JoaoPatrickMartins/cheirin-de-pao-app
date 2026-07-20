import { z } from 'zod'

export const CreatePixPaymentSchema = z
  .object({
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
    // Pedido único que paga a diferença via Pix: intenção do pedido (qtd TOTAL, data e slot).
    // Gravada na metadata do MP para o servidor criar a Order na aprovação (webhook/pull),
    // mesmo com o app fechado. Ausente numa compra de crédito comum.
    order: z
      .object({
        quantity: z.number().int().positive(),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        deliveryTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
      })
      .optional(),
  })
  .refine((d) => d.comboId || d.customQuantity, {
    message: 'comboId ou customQuantity obrigatório',
  })

export type CreatePixPaymentBody = z.infer<typeof CreatePixPaymentSchema>

export const CreateCardPaymentSchema = z
  .object({
    // ── Cartão salvo: cobrança off_session SEM CVV (1 toque / recarga) ───────
    savedCardId: z.string().optional(),
    // ── Cartão novo: confirmação via Stripe Elements no front (clientSecret) ──
    // saveCard=true marca setup_future_usage off_session p/ reaproveitar sem CVV depois
    saveCard: z.boolean().optional().default(false),
    // ── Valor ────────────────────────────────────────────────────────────
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
  })
  .refine((d) => d.comboId || d.customQuantity, {
    message: 'comboId ou customQuantity obrigatório',
  })

export type CreateCardPaymentBody = z.infer<typeof CreateCardPaymentSchema>
