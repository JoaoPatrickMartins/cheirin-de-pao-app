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
