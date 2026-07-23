import { z } from 'zod'

// Schemas locais do admin-market. As entidades (produto/categoria) reusam os schemas do
// pacote @cheirin-de-pao/shared; aqui ficam só os específicos do admin.

// Ajuste de estoque (admin): FIXED usa `stock`; DAILY usa `dailyCapacity`.
export const SetStockSchema = z
  .object({
    stock: z.number().int().min(0).optional(),
    dailyCapacity: z.number().int().min(0).optional(),
  })
  .refine((d) => d.stock != null || d.dailyCapacity != null, {
    message: 'Informe stock (fixo) ou dailyCapacity (diário).',
  })
export type SetStockBody = z.infer<typeof SetStockSchema>

// Config do mini market — mínimo da Cestinha (R$).
export const SetMarketConfigSchema = z.object({
  minimo: z.number().min(0),
})
export type SetMarketConfigBody = z.infer<typeof SetMarketConfigSchema>
