import { z } from 'zod'

/**
 * Schemas de validação da etapa de Separação.
 *
 * A separação é a etapa intermediária entre o corte/compra ao fornecedor e a
 * divisão de entregas: o operador confere e separa fisicamente cada pedido,
 * imprime o cupom e conclui o lote (condomínio + turno). Só pedidos concluídos
 * (SEPARATED) ficam disponíveis para a divisão entre entregadores.
 */

/** Marca/desmarca um pedido como separado (toggle SCHEDULED ↔ SEPARATED). */
export const SetSeparatedSchema = z.object({
  separated: z.boolean(),
})

export type SetSeparatedBody = z.infer<typeof SetSeparatedSchema>

/** Conclui a separação de um lote físico (condomínio + turno) de uma data. */
export const ConcludeSeparationSchema = z.object({
  condominiumId: z.string().min(1, 'condominiumId é obrigatório'),
  // slotId do turno; '' representa pedidos sem turno definido
  slotId: z.string(),
  // data de entrega (YYYY-MM-DD, BRT); default = hoje
  date: z.string().optional(),
})

export type ConcludeSeparationBody = z.infer<typeof ConcludeSeparationSchema>
