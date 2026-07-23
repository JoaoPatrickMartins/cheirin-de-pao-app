import { z } from 'zod'
import { ObjectIdSchema } from './index'

// Schemas do mini market "Além do Pãozin". Fonte única (backend valida com .parse; front
// reusa as regras). Os tipos são inferidos via z.infer no fim do arquivo.

// Dias da semana — chaves usadas em Product.availableDays (e alinhadas com a agenda).
export const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
export const WeekdaySchema = z.enum(WEEKDAYS)

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
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((d) => (d.stockType === 'FIXED' ? d.stock != null : true), {
    message: 'Estoque fixo exige quantidade em estoque',
    path: ['stock'],
  })
  .refine((d) => (d.stockType === 'DAILY' ? d.dailyCapacity != null : true), {
    message: 'Estoque diário exige capacidade por dia',
    path: ['dailyCapacity'],
  })

// Update parcial — as regras de coerência de estoque são revalidadas no service ao trocar o tipo.
export const UpdateProductSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  categoryId: ObjectIdSchema.optional(),
  price: z.number().positive().optional(),
  photoUrl: z.string().url().nullable().optional(),
  stockType: StockTypeSchema.optional(),
  stock: z.number().int().min(0).nullable().optional(),
  dailyCapacity: z.number().int().min(0).nullable().optional(),
  availableDays: z.array(WeekdaySchema).min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
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
export const MarketCheckoutSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().min(1),
  creditsApplied: z.number().int().min(0),
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
export type CartItemInput = z.infer<typeof CartItemSchema>
export type UpdateCartInput = z.infer<typeof UpdateCartSchema>
export type MarketCheckoutInput = z.infer<typeof MarketCheckoutSchema>
