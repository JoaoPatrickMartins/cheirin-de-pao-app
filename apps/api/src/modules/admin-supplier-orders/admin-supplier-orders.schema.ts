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
        quantity: z.number().int().min(1, 'quantity deve ser pelo menos 1'),
      }),
    )
    .min(1, 'Pelo menos um item é obrigatório'),
  cutoffTime: z.string().optional(),
  // Turno (slot) do pedido — pipeline por turno
  slotId: z.string().min(1, 'slotId é obrigatório'),
})

export type CreateSupplierOrderBody = z.infer<typeof CreateSupplierOrderSchema>
