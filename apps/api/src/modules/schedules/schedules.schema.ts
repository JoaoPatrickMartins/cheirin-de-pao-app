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

export const DaysSchema = z.record(z.string(), WeeklyQtySchema)

export const ScheduleBodySchema = z
  .object({
    days: DaysSchema.optional(),
    weeklyQty: WeeklyQtySchema.optional(),
    deliveryTime: z.string().optional(),
    notifyReconfigure: z.boolean().default(false),
  })
  .refine(
    (data) =>
      data.days !== undefined ||
      (data.weeklyQty !== undefined && data.deliveryTime !== undefined),
    { message: 'Forneça days (multi-slot) ou weeklyQty+deliveryTime (single-slot)' },
  )

export type ScheduleBody = z.infer<typeof ScheduleBodySchema>

export const PauseScheduleBodySchema = z.object({
  paused: z.boolean(),
})

export type PauseScheduleBody = z.infer<typeof PauseScheduleBodySchema>
