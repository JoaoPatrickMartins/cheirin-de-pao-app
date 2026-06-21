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
// CARD-07: cadastro avulso de cartão (sem cobrança). O token vem do Brick do MP;
// os demais campos são opcionais — os dados persistidos (brand/lastFour/expiry)
// são lidos da resposta do CustomerCard.create, não do cliente.
export const CreateSavedCardSchema = z.object({
  token: z.string().min(1, 'Token do cartão obrigatório'),
  paymentMethodId: z.string().optional(),
  issuerId: z.string().optional(),
  payerIdentification: z
    .object({
      type: z.string(),
      number: z.string(),
    })
    .optional(),
})

export type CreateSavedCardBody = z.infer<typeof CreateSavedCardSchema>
