import { z } from 'zod'

export const BuyCustomSchema = z.object({
  quantity: z.number().int().min(1),
})

export type BuyCustomBody = z.infer<typeof BuyCustomSchema>

export const AutoRechargeSchema = z.object({
  mode: z.enum(['acabar', 'semanal']),
  weekday: z.string().optional(),
  comboId: z.string(),
})

export type AutoRechargeBody = z.infer<typeof AutoRechargeSchema>

export const CardTokenSchema = z.object({
  token: z.string().min(1),
})

export type CardTokenBody = z.infer<typeof CardTokenSchema>
