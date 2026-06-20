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
