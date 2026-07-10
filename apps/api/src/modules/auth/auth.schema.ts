import { z } from 'zod'
import {
  CpfSchema,
  PhoneSchema,
  RefreshSchema,
  LoginSchema,
  PasswordSchema,
  SetPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from '@cheirin-de-pao/shared'

// Reexporta do shared (fonte única) para uso no controller.
export { RefreshSchema, LoginSchema, SetPasswordSchema, ResetPasswordSchema, ChangePasswordSchema }
export type RefreshBody = z.infer<typeof RefreshSchema>
export type LoginBody = z.infer<typeof LoginSchema>
export type SetPasswordBody = z.infer<typeof SetPasswordSchema>
export type ResetPasswordBody = z.infer<typeof ResetPasswordSchema>
export type ChangePasswordBody = z.infer<typeof ChangePasswordSchema>

// E-mail é obrigatório (canal do OTP). Telefone também é obrigatório:
// será usado no OTP por WhatsApp (futuro) e nos avisos de entrega.
// Senha obrigatória no cadastro (política de senha forte no PasswordSchema).
export const RegisterSchema = z.object({
  name: z.string().min(2),
  cpf: CpfSchema,
  birthDate: z.string().datetime().optional(),
  phone: PhoneSchema,
  email: z.string().email(),
  password: PasswordSchema,
  condominiumId: z.string(),
  apartment: z.string(),
  block: z.string().optional(),
})

export type RegisterBody = z.infer<typeof RegisterSchema>

// OTP de acesso apenas por e-mail neste primeiro momento.
export const SendOtpSchema = z.object({
  email: z.string().email(),
})

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
