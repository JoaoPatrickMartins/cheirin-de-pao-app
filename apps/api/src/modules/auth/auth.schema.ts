import { z } from 'zod'
import {
  COMPLEMENT_MAX_LENGTH,
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

// Dados do cliente comuns aos dois cadastros — por e-mail (RegisterSchema) e pelo Google
// (SocialCompleteSchema, em social-auth.schema.ts). Uma regra só, para os dois não divergirem.
// Telefone é obrigatório: será usado no OTP por WhatsApp (futuro) e nos avisos de entrega.
export const SignupProfileSchema = z.object({
  name: z.string().min(2),
  cpf: CpfSchema,
  birthDate: z.string().datetime().optional(),
  phone: PhoneSchema,
  condominiumId: z.string(),
  apartment: z.string(),
  block: z.string().optional(),
  complement: z.string().trim().max(COMPLEMENT_MAX_LENGTH).optional(),
  // Indique e Ganhe — OPCIONAIS de propósito: versões antigas do PWA em cache não mandam e seguem
  // cadastrando. E o `.catch(undefined)` é a invariante "a indicação nunca atrapalha o cadastro":
  // um `?ref=` adulterado (longo, com lixo) é descartado em vez de devolver 400 para o formulário
  // inteiro. Código com formato certo mas inexistente também não recusa — só não vincula.
  referralCode: z.string().trim().max(20).optional().catch(undefined),
  referralSource: z.enum(['LINK', 'CODE']).optional().catch(undefined),
})

// Cadastro por e-mail: e-mail obrigatório (canal do OTP) e senha obrigatória (política forte no
// PasswordSchema).
export const RegisterSchema = SignupProfileSchema.extend({
  email: z.string().email(),
  password: PasswordSchema,
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

