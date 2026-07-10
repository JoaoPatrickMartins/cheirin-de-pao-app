import { z } from 'zod'

/**
 * HookListQuerySchema — query de GET /admin/hook-requests.
 *
 * status: pending (solicitado, não entregue) | delivered (entregue) | all.
 * sort: recent (data da solicitação, desc) | name (alfabético).
 */
export const HookListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['pending', 'delivered', 'all']).optional().default('pending'),
  sort: z.enum(['recent', 'name']).optional().default('recent'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})
export type HookListQuery = z.infer<typeof HookListQuerySchema>
