import { z } from 'zod'

/**
 * Schema de validação para atualização de status de pedido pelo Admin.
 * T-05-01: Apenas ADMIN pode mudar status — role check no controller.
 *
 * Status aceitos pelo endpoint genérico de status (ciclo de vida v2):
 *   SEPARATED | OUT_FOR_DELIVERY | DELIVERED | NOT_DELIVERED
 *
 * Cancelamento (CANCELLED) fica no fluxo dedicado de admin-clients, que também
 * faz o estorno de créditos — não é exposto aqui para evitar caminho sem estorno.
 *
 * O schema valida que apenas valores válidos chegam ao service.
 * A validação da transição em si (VALID_TRANSITIONS) ocorre no service.
 */
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['SEPARATED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'], {
    message: 'Status inválido. Use SEPARATED, OUT_FOR_DELIVERY, DELIVERED ou NOT_DELIVERED.',
  }),
  // Motivo opcional — relevante para NOT_DELIVERED (cliente ausente, endereço, etc.)
  reason: z.string().max(500).optional(),
})

export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusSchema>

/**
 * Schema de validacao para atribuicao de entregador a orders em batch.
 * D-11/D-13: Admin atribui courierId a uma lista de orderIds ou por condominiumId+date.
 * T-06-04: courierId e orderIds validados pelo Zod antes de chegar ao service.
 */
export const AssignCourierSchema = z.object({
  courierId: z.string().min(1, 'courierId e obrigatorio'),
  orderIds: z.array(z.string().min(1)).min(1).optional(),
  condominiumId: z.string().optional(),
  date: z.string().optional(),
})

export type AssignCourierBody = z.infer<typeof AssignCourierSchema>

/**
 * Schema de aprovação da divisão de entregas.
 * Despacha (SEPARATED → OUT_FOR_DELIVERY) os pedidos de cada entregador em uma única
 * chamada. slotId/date são informativos (o gate real vem dos orderIds + status SEPARATED).
 */
export const ApproveDivisionSchema = z.object({
  slotId: z.string().optional(),
  date: z.string().optional(),
  assignments: z
    .array(
      z.object({
        courierId: z.string().min(1, 'courierId e obrigatorio'),
        orderIds: z.array(z.string().min(1)).min(1, 'orderIds nao pode ser vazio'),
      }),
    )
    .min(1, 'Informe ao menos um entregador com pedidos'),
})

export type ApproveDivisionBody = z.infer<typeof ApproveDivisionSchema>

/**
 * Filtros do ledger de pedidos (verificação geral + histórico + limbo).
 * `status` chega como CSV (ex.: "DELIVERED,NOT_DELIVERED") e vira array.
 */
export const LedgerQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined)),
  condominiumId: z.string().optional(),
  courierId: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
})

export type LedgerQuery = z.infer<typeof LedgerQuerySchema>

/** Body do estorno de um pedido (atalho do detalhe). */
export const RefundOrderSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type RefundOrderBody = z.infer<typeof RefundOrderSchema>

/**
 * Schema da resolução de um pedido "parado" (data passada sem desfecho).
 *
 * outcome: desfecho terminal escolhido pelo admin.
 *   DELIVERED     — entregue a posteriori (não mexe em créditos).
 *   NOT_DELIVERED — falha de entrega (motivo obrigatório).
 *   CANCELLED     — pedido anulado (motivo obrigatório).
 * refundCredits: devolve os pães ao saldo no mesmo passo (só aplicável a
 *   NOT_DELIVERED/CANCELLED; ignorado em DELIVERED).
 */
export const ResolveOrderSchema = z
  .object({
    outcome: z.enum(['DELIVERED', 'NOT_DELIVERED', 'CANCELLED'], {
      message: 'Desfecho inválido. Use DELIVERED, NOT_DELIVERED ou CANCELLED.',
    }),
    reason: z.string().max(500).optional(),
    refundCredits: z.boolean().optional(),
  })
  .refine((d) => d.outcome === 'DELIVERED' || !!d.reason?.trim(), {
    message: 'Motivo é obrigatório para não entregue ou cancelamento.',
    path: ['reason'],
  })

export type ResolveOrderBody = z.infer<typeof ResolveOrderSchema>
