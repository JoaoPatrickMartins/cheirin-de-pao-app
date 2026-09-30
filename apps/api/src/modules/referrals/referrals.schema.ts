import { z } from 'zod'

/** Body de `POST /referrals/celebration/seen` — ecoa o `celebration.seen` do summary. */
export const CelebrationSeenSchema = z.object({
  referralIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(200).optional(),
  goalThresholds: z.array(z.number().int().min(1).max(999)).max(10).optional(),
  welcome: z.boolean().optional(),
})

export type CelebrationSeenBody = z.infer<typeof CelebrationSeenSchema>
