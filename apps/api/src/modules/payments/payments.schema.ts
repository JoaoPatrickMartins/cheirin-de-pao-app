import { z } from 'zod'

export const CreatePixPaymentSchema = z
  .object({
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
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
