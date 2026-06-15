import { z } from 'zod'

export const WeeklyQtySchema = z.object({
  seg: z.number().int().min(0).max(12),
  ter: z.number().int().min(0).max(12),
  qua: z.number().int().min(0).max(12),
  qui: z.number().int().min(0).max(12),
  sex: z.number().int().min(0).max(12),
  sab: z.number().int().min(0).max(12),
  dom: z.number().int().min(0).max(12),
})

export type WeeklyQty = z.infer<typeof WeeklyQtySchema>

export const ScheduleBodySchema = z.object({
  weeklyQty: WeeklyQtySchema,
  deliveryTime: z.enum(['06:30', '07:00', '07:30', '08:00']),
  notifyReconfigure: z.boolean().default(false),
})

export type ScheduleBody = z.infer<typeof ScheduleBodySchema>
