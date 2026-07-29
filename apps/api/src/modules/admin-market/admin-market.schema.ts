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

// Config do mini market — mínimo da Cestinha (R$) e mínimo p/ liberar cartão (R$; 0 = sempre).
export const SetMarketConfigSchema = z.object({
  minimo: z.number().min(0),
  cartaoMinimo: z.number().min(0).optional(),
})
export type SetMarketConfigBody = z.infer<typeof SetMarketConfigSchema>

/** Estados de uma Cestinha (espelha MarketOrderStatus). */
const MARKET_ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'SCHEDULED',
  'SEPARATED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'NOT_DELIVERED',
  'CANCELLED',
] as const

// Filtros da lista de Cestinhas (admin). `status` chega como CSV, igual ao ledger de pedidos.
export const MarketOrderFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(',')
            .map((x) => x.trim())
            .filter((x): x is (typeof MARKET_ORDER_STATUSES)[number] =>
              (MARKET_ORDER_STATUSES as readonly string[]).includes(x),
            )
        : undefined,
    ),
  condominiumId: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
})
export type MarketOrderFilters = z.infer<typeof MarketOrderFiltersSchema>

/**
 * Cancelamento de uma Cestinha pelo admin — SEM gate de corte.
 * `refundCredits` e `returnStock` default true: cancelar significa que o pedido não vai sair, então
 * o cliente recebe de volta e o produto volta para o estoque. O admin pode desligar cada um.
 */
export const CancelMarketOrderSchema = z.object({
  reason: z.string().max(500).optional(),
  refundCredits: z.boolean().optional(),
  returnStock: z.boolean().optional(),
})
export type CancelMarketOrderBody = z.infer<typeof CancelMarketOrderSchema>

/**
 * ResolveNotDeliveredSchema — desfecho físico de uma Cestinha NÃO ENTREGUE (Onda G2).
 *
 * `returnStock` e `refundCredits` são **obrigatórios e sem default**: a política é justamente que
 * ninguém decide isso por omissão. Só quem apurou o que aconteceu com a mercadoria responde.
 */
export const ResolveNotDeliveredSchema = z.object({
  returnStock: z.boolean(),
  refundCredits: z.boolean(),
  reason: z.string().max(500).optional(),
})
export type ResolveNotDeliveredBody = z.infer<typeof ResolveNotDeliveredSchema>
