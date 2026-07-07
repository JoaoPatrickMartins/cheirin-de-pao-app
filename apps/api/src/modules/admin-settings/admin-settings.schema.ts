import { z } from 'zod'

/**
 * UpdateSlotsSchema — valida as edições da config global de slots.
 *
 * Editável: time (horário de entrega), cutoffTime, label, emoji, isActive (por slotId).
 * A partir da Etapa B `time` é editável — a junção de agendas/pedidos usa `slotId`.
 * `name`/`slotId` permanecem imutáveis (identidade).
 */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const UpdateSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        slotId: z.string().min(1, 'slotId obrigatório'),
        time: z.string().regex(HHMM, 'Formato inválido. Use HH:MM.').optional(),
        cutoffTime: z.string().regex(HHMM, 'Formato inválido. Use HH:MM.').optional(),
        label: z.string().min(1).max(40).optional(),
        emoji: z.string().max(8).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .min(1, 'Informe ao menos um slot'),
})

export type UpdateSlotsBody = z.infer<typeof UpdateSlotsSchema>

/**
 * UpdateAvulsoSchema — valida a configuração de compra avulsa.
 */
export const UpdateAvulsoSchema = z.object({
  limit: z.number().int().min(1, 'Limite mínimo é 1'),
  unitPrice: z.number().min(0, 'Preço não pode ser negativo'),
})

export type UpdateAvulsoBody = z.infer<typeof UpdateAvulsoSchema>

/**
 * UpdatePedidoMinimoSchema — valida os pedidos mínimos (agenda por dia + pedido único).
 *
 * - `unico`: mínimo do pedido único (1..20 — casa com o teto do pedido único).
 * - `agenda`: mínimo por dia da semana (0..12 — casa com o teto do StepperInline da agenda).
 *   0 = sem mínimo naquele dia. Aplica-se por turno quando a qtd do dia é > 0.
 */
const WeekdayMinSchema = z.number().int().min(0).max(12)

export const UpdatePedidoMinimoSchema = z.object({
  unico: z.number().int().min(1, 'Mínimo do pedido único é 1').max(20, 'Máximo é 20'),
  agenda: z.object({
    seg: WeekdayMinSchema,
    ter: WeekdayMinSchema,
    qua: WeekdayMinSchema,
    qui: WeekdayMinSchema,
    sex: WeekdayMinSchema,
    sab: WeekdayMinSchema,
    dom: WeekdayMinSchema,
  }),
})

export type UpdatePedidoMinimoBody = z.infer<typeof UpdatePedidoMinimoSchema>
export type WeekdayMinimums = UpdatePedidoMinimoBody['agenda']
