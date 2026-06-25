import { z } from 'zod'
import { PhoneSchema } from '@cheirin-de-pao/shared'

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  birthDate: z.string().datetime().optional(),
  condominiumId: z.string().optional(),
  apartment: z.string().optional(),
  block: z.string().optional(),
})

export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>

export const ContactChangeRequestSchema = z
  .object({
    phone: PhoneSchema.optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })

export type ContactChangeRequestBody = z.infer<typeof ContactChangeRequestSchema>

export const ContactChangeConfirmSchema = z.object({
  code: z.string().length(4),
})

export type ContactChangeConfirmBody = z.infer<typeof ContactChangeConfirmSchema>
