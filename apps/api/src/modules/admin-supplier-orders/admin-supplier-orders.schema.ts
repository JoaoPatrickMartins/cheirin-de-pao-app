// admin-supplier-orders.schema.ts — Zod schemas para validação
// Requirements: ADMO-05, ADMO-06, ADMO-07, ADMO-08, ADMO-09
// T-07-04-03: Zod valida array de items; service verifica Supplier existe via findUnique

import { z } from 'zod'

/**
 * CreateSupplierOrderSchema — validação do body de criação de pedido ao fornecedor.
 *
 * items: lista de { supplierId, quantity } com pelo menos 1 item.
 * cutoffTime: horário de corte opcional (ISO string).
 */
export const CreateSupplierOrderSchema = z.object({
  items: z
    .array(
      z.object({
        supplierId: z.string().min(1, 'supplierId é obrigatório'),
        // `productId` ausente = pão (compat com o fluxo antigo, que só sabia pedir pão). Com ele,
        // o custo vem da matriz de fornecimento daquele (fornecedor, produto) — D-8.
        productId: z.string().min(1).optional(),
        quantity: z.number().int().min(1, 'quantity deve ser pelo menos 1'),
      }),
    )
    .min(1, 'Pelo menos um item é obrigatório'),
  cutoffTime: z.string().optional(),
  // Turno (slot) do pedido — pipeline por turno
  slotId: z.string().min(1, 'slotId é obrigatório'),
  // Data de entrega alvo (YYYY-MM-DD). Opcional — sem ela usa a Regra A (próxima entrega).
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve ser YYYY-MM-DD')
    .optional(),
})

export type CreateSupplierOrderBody = z.infer<typeof CreateSupplierOrderSchema>

/**
 * CreateRestockSchema — body do pedido de REPOSIÇÃO de inventário (D-9 / H8).
 *
 * Sem `slotId` e sem `date`: reposição não pertence a um turno nem a um dia de entrega (é a
 * diferença de regime em relação ao `DELIVERY_BATCH`). `productId` é OBRIGATÓRIO aqui — não existe
 * "reposição de pão", e sem o produto não há como resolver o custo na matriz de fornecimento (D-8).
 */
export const CreateRestockSchema = z.object({
  items: z
    .array(
      z.object({
        supplierId: z.string().min(1, 'supplierId é obrigatório'),
        productId: z.string().min(1, 'productId é obrigatório'),
        quantity: z.number().int().min(1, 'quantity deve ser pelo menos 1'),
      }),
    )
    .min(1, 'Pelo menos um item é obrigatório'),
})

export type CreateRestockBody = z.infer<typeof CreateRestockSchema>

/** Querystring de `GET /admin/supplier-orders/restock-suggestion`. */
export const RestockSuggestionQuerySchema = z.object({
  coverDays: z.coerce.number().int().min(1).max(365).optional(),
})
