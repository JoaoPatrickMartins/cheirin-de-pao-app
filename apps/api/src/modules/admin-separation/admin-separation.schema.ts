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

/** Um lote físico: condomínio + turno ('' = pedidos sem turno definido). */
export const SeparationScopeSchema = z.object({
  condominiumId: z.string().min(1, 'condominiumId é obrigatório'),
  slotId: z.string(),
})

export type SeparationScopeInput = z.infer<typeof SeparationScopeSchema>

/**
 * Conclui a separação de um ou mais lotes físicos (condomínio + turno) de uma data.
 *
 * Duas formas aceitas:
 *  - `scopes: [{ condominiumId, slotId }]` — vários lotes numa tacada (seleção múltipla da tela).
 *  - `condominiumId` + `slotId` — um lote só (forma original, ainda usada pelos botões por lote).
 *
 * `scopes` é uma lista de PARES explícitos, nunca `condominiumIds × slotIds`: o quadro esconde
 * turno cuja compra não foi finalizada (gate progressivo em `getBoard`), e um produto cartesiano
 * concluiria lote que o operador nem viu na tela.
 */
export const ConcludeSeparationSchema = z
  .object({
    condominiumId: z.string().min(1).optional(),
    // slotId do turno; '' representa pedidos sem turno definido
    slotId: z.string().optional(),
    scopes: z.array(SeparationScopeSchema).min(1).optional(),
    // data de entrega (YYYY-MM-DD, BRT); default = hoje
    date: z.string().optional(),
  })
  .refine((b) => (b.scopes?.length ?? 0) > 0 || (!!b.condominiumId && b.slotId !== undefined), {
    message: 'informe scopes ou condominiumId + slotId',
  })

export type ConcludeSeparationBody = z.infer<typeof ConcludeSeparationSchema>
