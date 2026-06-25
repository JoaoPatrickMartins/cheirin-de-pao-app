import { z } from 'zod'
import { CpfSchema, PhoneSchema } from '@cheirin-de-pao/shared'

export const RegisterSchema = z
  .object({
    name: z.string().min(2),
    cpf: CpfSchema,
    birthDate: z.string().datetime().optional(),
    phone: PhoneSchema.optional(),
    email: z.string().email().optional(),
    channel: z.enum(['sms', 'email']),
    condominiumId: z.string(),
    apartment: z.string(),
    block: z.string().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })

export type RegisterBody = z.infer<typeof RegisterSchema>

export const SendOtpSchema = z
  .object({
    phone: PhoneSchema.optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })

export type SendOtpBody = z.infer<typeof SendOtpSchema>

export const VerifyOtpSchema = z.object({
  userId: z.string(),
  code: z.string().length(4),
  deviceId: z.string(),
})

export type VerifyOtpBody = z.infer<typeof VerifyOtpSchema>

export const RegisterCourierSchema = z
  .object({
    name: z.string().min(2),
    cpf: CpfSchema,
    phone: PhoneSchema.optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })

export type RegisterCourierBody = z.infer<typeof RegisterCourierSchema>
