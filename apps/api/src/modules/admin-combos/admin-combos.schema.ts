import { z } from 'zod'

/**
 * CreateComboSchema — valida criação de combo de créditos.
 * T-07-02-04: Zod valida body antes de operação no banco.
 */
export const CreateComboSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  tag: z.string().optional(),
})

export type CreateComboBody = z.infer<typeof CreateComboSchema>

export const UpdateComboSchema = CreateComboSchema.partial()
export type UpdateComboBody = z.infer<typeof UpdateComboSchema>

/**
 * TogglePromotionSchema — valida toggle de promoção.
 * T-07-02-04: discountValue fixo em 15% no serviço — não configurável via request.
 */
export const TogglePromotionSchema = z.object({
  active: z.boolean(),
})

export type TogglePromotionBody = z.infer<typeof TogglePromotionSchema>
