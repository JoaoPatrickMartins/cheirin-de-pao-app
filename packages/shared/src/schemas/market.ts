import { z } from 'zod'
import { ObjectIdSchema } from './index'

// Schemas do mini market "Além do Pãozin". Fonte única (backend valida com .parse; front
// reusa as regras). Os tipos são inferidos via z.infer no fim do arquivo.

// Dias da semana — chaves usadas em Product.availableDays (e alinhadas com a agenda).
export const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
export const WeekdaySchema = z.enum(WEEKDAYS)

// Horário "HH:MM" 24h zero-padded — a comparação lexicográfica vale como cronológica, que é o
// que a régua de corte (lib/cutoff.ts) assume em todo lugar.
export const HHMMSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)')

// Enums (espelham os enums Prisma do mini market).
export const StockTypeSchema = z.enum(['DAILY', 'FIXED'])
export const MarketOrderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'SCHEDULED',
  'SEPARATED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'NOT_DELIVERED',
  'CANCELLED',
])

// ── Categoria ─────────────────────────────────────────────────────────────
export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(40),
  emoji: z.string().trim().max(8).optional(),
  sortOrder: z.number().int().min(0).optional(),
})
export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ── Produto ───────────────────────────────────────────────────────────────
// availableDays: ausente = sempre disponível; lista de dias = restrito a esses dias.
//
// availableUntil (FECHA) / availableFrom (REABRE): horário de VENDA, relógio de loja absoluto.
// Não confundir com `availableDays`, que é relativo à data de ENTREGA.
//
// A janela PODE cruzar a meia-noite — é a ordem entre os dois que decide: `from > until` significa
// "fechado de until até from" ("fecha 20:00, reabre 22:00" = fechado só nessas 2 horas). O único
// par inválido é fechar e reabrir na mesma hora: duração zero ou 24h, sem resposta certa.
const windowRefine = <T extends { availableFrom?: string | null; availableUntil?: string | null }>(
  d: T,
): boolean => !(d.availableFrom && d.availableUntil) || d.availableFrom !== d.availableUntil

const WINDOW_MESSAGE = {
  message: 'O horário de fechar e o de reabrir não podem ser iguais.',
  path: ['availableUntil'],
}

// Promoção do produto — espelha o desconto de COMBO (enum DiscountType do Prisma). Ligar a
// promoção exige dizer o tipo E o valor: um selo "promoção" sem desconto seria propaganda sem
// lastro. A relação entre o desconto e o PREÇO daquele produto (não zerar, teto de 90%) só dá
// para julgar no service, que conhece o preço — ver lib/product-pricing.ts.
export const DiscountTypeSchema = z.enum(['PERCENT', 'FIXED'])

const promoRefine = <T extends { isPromo?: boolean; promoType?: unknown; promoValue?: number | null }>(
  d: T,
): boolean => d.isPromo !== true || (d.promoType != null && d.promoValue != null)

const PROMO_MESSAGE = {
  message: 'Para ligar a promoção, informe o tipo e o valor do desconto.',
  path: ['promoValue'],
}

const PROMO_FIELDS = {
  isPromo: z.boolean().optional(),
  promoType: DiscountTypeSchema.nullable().optional(),
  promoValue: z.number().positive().nullable().optional(),
  promoUntil: z.string().datetime().nullable().optional(),
}

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome obrigatório').max(80),
    description: z.string().trim().max(280).optional(),
    categoryId: ObjectIdSchema,
    price: z.number().positive('Preço deve ser maior que zero'),
    photoUrl: z.string().url().optional(),
    stockType: StockTypeSchema,
    stock: z.number().int().min(0).optional(),
    dailyCapacity: z.number().int().min(0).optional(),
    availableDays: z.array(WeekdaySchema).min(1).optional(),
    availableFrom: HHMMSchema.nullable().optional(),
    availableUntil: HHMMSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isNew: z.boolean().optional(),
    newUntil: z.string().datetime().nullable().optional(),
    ...PROMO_FIELDS,
  })
  .refine((d) => (d.stockType === 'FIXED' ? d.stock != null : true), {
    message: 'Estoque fixo exige quantidade em estoque',
    path: ['stock'],
  })
  .refine((d) => (d.stockType === 'DAILY' ? d.dailyCapacity != null : true), {
    message: 'Estoque diário exige capacidade por dia',
    path: ['dailyCapacity'],
  })
  .refine(windowRefine, WINDOW_MESSAGE)
  .refine(promoRefine, PROMO_MESSAGE)

// Update parcial — as regras de coerência de estoque são revalidadas no service ao trocar o tipo.
//
// ATENÇÃO à janela: num PATCH o cliente pode mandar só uma das pontas, e o refine abaixo só
// consegue julgar o par que chegou. O service revalida contra o valor JÁ PERSISTIDO da outra
// ponta — senão daria para gravar 10:00→06:00 em duas chamadas.
export const UpdateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(280).nullable().optional(),
    categoryId: ObjectIdSchema.optional(),
    price: z.number().positive().optional(),
    photoUrl: z.string().url().nullable().optional(),
    stockType: StockTypeSchema.optional(),
    stock: z.number().int().min(0).nullable().optional(),
    dailyCapacity: z.number().int().min(0).nullable().optional(),
    availableDays: z.array(WeekdaySchema).min(1).nullable().optional(),
    availableFrom: HHMMSchema.nullable().optional(),
    availableUntil: HHMMSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isNew: z.boolean().optional(),
    newUntil: z.string().datetime().nullable().optional(),
    ...PROMO_FIELDS,
  })
  .refine(windowRefine, WINDOW_MESSAGE)
  .refine(promoRefine, PROMO_MESSAGE)

/**
 * Pausa de vitrine de um produto (admin). `minutes` ausente = pausa SEM prazo ("até eu religar").
 * Com prazo, o produto despausa sozinho ao passar do instante — sem cron, o estado é derivado.
 * Teto de 24h: acima disso o certo é a pausa sem prazo, não um número gigante.
 */
export const PauseProductSchema = z.object({
  minutes: z.number().int().min(1).max(1440).optional(),
  reason: z.string().trim().max(120).optional(),
})

/**
 * Ordem da vitrine (admin) — as DUAS listas viajam juntas porque marcar novidade e ordenar são a
 * mesma ação: arrastar um item entre as seções é o que liga/desliga o selo. Salvar em uma
 * transação só é o que impede a tela de gravar metade (ordem nova, selo velho).
 */
export const ReorderProductsSchema = z.object({
  novidades: z.array(ObjectIdSchema).max(200),
  // `.default([])` para uma aba aberta antes do deploy não quebrar ao salvar: ela manda duas
  // listas e o balde de promoções chega vazio, em vez de 400.
  promocoes: z.array(ObjectIdSchema).max(200).default([]),
  catalogo: z.array(ObjectIdSchema).max(200),
})

// ── Carrinho ("Cestinha") ───────────────────────────────────────────────────
export const CartItemSchema = z.object({
  productId: ObjectIdSchema,
  qty: z.number().int().min(1).max(99),
})
export const UpdateCartSchema = z.object({
  items: z.array(CartItemSchema).max(50),
  // pães do add-on (C8) que viajam na mesma Cestinha
  breadQty: z.number().int().min(0).max(100).optional(),
})

// ── Checkout ──────────────────────────────────────────────────────────────
// O servidor lê os itens da Cestinha persistida e recalcula o total — o cliente só envia
// a intenção de entrega + split + método. creditsApplied = pãezinhos escolhidos (0..saldo).
//
// DECIMAL de propósito (não `.int()`): o crédito é fracionado (1 pão = 1000 milésimos), então
// um item de R$ 1,80 com avulso R$ 1,20 é pago com 1,5 🥖. O servidor converte para milésimos e
// clampa por saldo e custo — este número é só a sugestão do cliente.
export const MarketCheckoutSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().min(1),
  creditsApplied: z.number().min(0),
  paymentMethod: z.enum(['pix', 'card']).optional(), // ausente quando 100% crédito
  savedCardId: ObjectIdSchema.optional(),
  idempotencyKey: z.string().uuid(),
})

// ── Tipos inferidos ─────────────────────────────────────────────────────────
export type Weekday = z.infer<typeof WeekdaySchema>
export type StockType = z.infer<typeof StockTypeSchema>
export type MarketOrderStatus = z.infer<typeof MarketOrderStatusSchema>
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type DiscountTypeInput = z.infer<typeof DiscountTypeSchema>
export type PauseProductInput = z.infer<typeof PauseProductSchema>
export type ReorderProductsInput = z.infer<typeof ReorderProductsSchema>
export type CartItemInput = z.infer<typeof CartItemSchema>
export type UpdateCartInput = z.infer<typeof UpdateCartSchema>
export type MarketCheckoutInput = z.infer<typeof MarketCheckoutSchema>
