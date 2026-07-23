import { z } from 'zod'

/**
 * HookListQuerySchema — query de GET /admin/hook-requests.
 *
 * status: pending (REQUESTED — na fila) | delivered (DELIVERED) | all (ambos).
 *   Pagamentos pendentes (PENDING_PAYMENT) e cancelados não aparecem na fila do admin.
 * type: all | free | paid | bonus — filtro por tipo de gancho.
 * sort: recent (data da solicitação, desc) | name (alfabético — ordenação da página) |
 *   location (condomínio → bloco → apartamento; ordena o conjunto completo antes de paginar).
 */
export const HookListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['pending', 'delivered', 'all']).optional().default('pending'),
  type: z.enum(['all', 'free', 'paid', 'bonus']).optional().default('all'),
  sort: z.enum(['recent', 'name', 'location']).optional().default('recent'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})
export type HookListQuery = z.infer<typeof HookListQuerySchema>

/**
 * GrantHookSchema — body de POST /admin/hook-requests/grant.
 * Concede um gancho de bonificação (BONUS) a um cliente. reason é opcional.
 */
export const GrantHookSchema = z.object({
  userId: z.string().min(1, 'userId obrigatório'),
  reason: z.string().max(280, 'Motivo muito longo').optional(),
})
export type GrantHookBody = z.infer<typeof GrantHookSchema>
