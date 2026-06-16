import { z } from 'zod'

/**
 * UpdateCutoffSchema — valida o horário de corte.
 * T-07-02-02: regex impede valores malformados antes do upsert.
 */
export const UpdateCutoffSchema = z.object({
  cutoffTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato inválido. Use HH:MM.'),
})

export type UpdateCutoffBody = z.infer<typeof UpdateCutoffSchema>

/**
 * UpdateAvulsoSchema — valida a configuração de compra avulsa.
 */
export const UpdateAvulsoSchema = z.object({
  limit: z.number().int().min(1, 'Limite mínimo é 1'),
  unitPrice: z.number().min(0, 'Preço não pode ser negativo'),
})

export type UpdateAvulsoBody = z.infer<typeof UpdateAvulsoSchema>
