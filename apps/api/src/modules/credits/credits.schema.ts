import { z } from 'zod'

export const BuyCustomSchema = z.object({
  quantity: z.number().int().min(1),
})

export type BuyCustomBody = z.infer<typeof BuyCustomSchema>

export const AutoRechargeSchema = z
  .object({
    // active liga/desliga a recarga — é o que o corte checa (autoRecharge.active).
    active: z.boolean().optional().default(false),
    mode: z.enum(['acabar', 'semanal']).optional().default('acabar'),
    weekday: z.string().optional(),
    // comboId só é obrigatório ao ATIVAR (ao desativar pode vir vazio/ausente).
    comboId: z.string().optional(),
  })
  .refine((d) => !d.active || !!d.comboId, {
    message: 'comboId é obrigatório ao ativar a recarga automática',
  })

export type AutoRechargeBody = z.infer<typeof AutoRechargeSchema>

export const CardTokenSchema = z.object({
  token: z.string().min(1),
})

export type CardTokenBody = z.infer<typeof CardTokenSchema>
