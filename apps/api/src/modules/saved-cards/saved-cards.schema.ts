import { z } from 'zod'

// ── Params ──────────────────────────────────────────────────────────────────
export const SavedCardParamsSchema = z.object({
  id: z.string().min(1, 'ID do cartão obrigatório'),
})

export type SavedCardParams = z.infer<typeof SavedCardParamsSchema>

// ── Set Default Body ─────────────────────────────────────────────────────────
export const SetDefaultBodySchema = z.object({
  isDefault: z.boolean(),
})

export type SetDefaultBody = z.infer<typeof SetDefaultBodySchema>

// ── Create Card Body ──────────────────────────────────────────────────────────
// CARD-07: persiste o cartão após o front confirmar o SetupIntent via Stripe Elements.
// Recebe o PaymentMethod (pm_...) já anexado ao Customer; brand/lastFour/expiry são
// lidos do PaymentMethod no Stripe, nunca do cliente.
export const CreateSavedCardSchema = z.object({
  paymentMethodId: z.string().min(1, 'paymentMethodId obrigatório'),
})

export type CreateSavedCardBody = z.infer<typeof CreateSavedCardSchema>
