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

/**
 * Marca/desmarca a separação de uma parada SÓ-Cestinha (cliente sem pedido de pão no turno).
 * É uma lista porque um cliente pode ter mais de uma Cestinha no mesmo turno e a tela de
 * separação as mostra como uma única linha/parada.
 */
export const SetMarketSeparatedSchema = z.object({
  marketOrderIds: z.array(z.string().min(1)).min(1, 'marketOrderIds é obrigatório'),
  separated: z.boolean(),
})

export type SetMarketSeparatedBody = z.infer<typeof SetMarketSeparatedSchema>

/** Conclui a separação de um lote físico (condomínio + turno) de uma data. */
export const ConcludeSeparationSchema = z.object({
  condominiumId: z.string().min(1, 'condominiumId é obrigatório'),
  // slotId do turno; '' representa pedidos sem turno definido
  slotId: z.string(),
  // data de entrega (YYYY-MM-DD, BRT); default = hoje
  date: z.string().optional(),
})

export type ConcludeSeparationBody = z.infer<typeof ConcludeSeparationSchema>
