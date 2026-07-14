import { z } from 'zod'

// Base ID schema — MongoDB ObjectId as 24-char hex string
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId')

// User role enum — matches Prisma UserRole enum values exactly
export const UserRoleSchema = z.enum(['CLIENT', 'COURIER', 'ADMIN'])

// Condominium type enum — matches Prisma CondoType enum values exactly
export const CondoTypeSchema = z.enum(['SINGLE_ENTRANCE', 'BLOCKS'])

// Internal helper — not exported
function validateCpfDigits(digits: string): boolean {
  if (digits.length !== 11) return false
  // Reject all-same-digit CPFs (e.g., 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // First check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  let remainder = sum % 11
  const firstDigit = remainder < 2 ? 0 : 11 - remainder
  if (firstDigit !== parseInt(digits[9])) return false

  // Second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  remainder = sum % 11
  const secondDigit = remainder < 2 ? 0 : 11 - remainder
  if (secondDigit !== parseInt(digits[10])) return false

  return true
}

// CPF schema — strips formatting, validates módulo-11 check digits
export const CpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos' })
  .refine((v) => validateCpfDigits(v), { message: 'CPF inválido' })

/**
 * Checagem de CPF reutilizável pelo front (sem depender do Zod no bundle web).
 * Aceita valor com ou sem máscara. Retorna true só quando os 11 dígitos e os
 * dígitos verificadores módulo-11 são válidos.
 */
export function isValidCpf(value: string): boolean {
  return validateCpfDigits(value.replace(/\D/g, ''))
}

/**
 * Normaliza telefone para apenas dígitos (remove máscara, espaços, "+").
 * Ex.: "+55 (11) 99000-1234" → "5511990001234"; "(11) 99000-1234" → "11990001234".
 * Fonte única de verdade para escrita E busca de telefone — mantém login OTP
 * (findUserByPhone) consistente com o que é armazenado.
 */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

// Phone schema — normaliza para dígitos e valida faixa BR (10–13 dígitos:
// DDD+número, opcionalmente com código do país 55).
export const PhoneSchema = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v) => v.length >= 10 && v.length <= 13, { message: 'Telefone inválido' })

// ── Autenticação por senha ────────────────────────────────────────────────
// Política de senha — fonte única (backend valida com .parse; front reusa as regras/mensagens).
// Critérios de senha forte: 8–72 chars, com minúscula, maiúscula e número.
// (72 = limite de bytes do bcrypt; acima disso ele truncaria silenciosamente.)
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres` })
  .max(PASSWORD_MAX_LENGTH, { message: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres` })
  .refine((v) => /[a-z]/.test(v), { message: 'A senha deve conter ao menos uma letra minúscula' })
  .refine((v) => /[A-Z]/.test(v), { message: 'A senha deve conter ao menos uma letra maiúscula' })
  .refine((v) => /\d/.test(v), { message: 'A senha deve conter ao menos um número' })

// Checagem de força reutilizável pelo front (sem depender do Zod no bundle web).
// Retorna a lista de critérios não atendidos (vazia = senha válida).
export function passwordIssues(password: string): string[] {
  const issues: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  if (password.length > PASSWORD_MAX_LENGTH) issues.push(`Máximo ${PASSWORD_MAX_LENGTH} caracteres`)
  if (!/[a-z]/.test(password)) issues.push('Uma letra minúscula')
  if (!/[A-Z]/.test(password)) issues.push('Uma letra maiúscula')
  if (!/\d/.test(password)) issues.push('Um número')
  return issues
}

// UUID do dispositivo (gerado pelo app na 1ª instalação) — associa sessões/refresh.
export const DeviceIdSchema = z.string().min(1, { message: 'deviceId obrigatório' })

// Login por e-mail + senha. `password` só valida presença (não vaza a política).
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: 'Senha obrigatória' }),
  deviceId: DeviceIdSchema,
})

// Definição de senha no 1º acesso (autenticado, só quando ainda não há senha).
export const SetPasswordSchema = z.object({
  password: PasswordSchema,
})

// Recuperação via OTP: confirma o código e define a nova senha (atômico).
export const ResetPasswordSchema = z.object({
  userId: ObjectIdSchema,
  code: z.string().length(4, { message: 'Código deve ter 4 dígitos' }),
  deviceId: DeviceIdSchema,
  newPassword: PasswordSchema,
})

// Troca de senha logado — exige a senha atual.
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Senha atual obrigatória' }),
  newPassword: PasswordSchema,
})

// Renovação de sessão — troca o refresh token por um novo par de tokens.
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, { message: 'refreshToken obrigatório' }),
  deviceId: DeviceIdSchema,
})
