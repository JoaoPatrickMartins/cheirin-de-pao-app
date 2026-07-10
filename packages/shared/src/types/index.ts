import { z } from 'zod'
import {
  UserRoleSchema,
  CondoTypeSchema,
  LoginSchema,
  SetPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  RefreshSchema,
} from '../schemas'

// Base ID type — MongoDB ObjectId as string
export type ID = string

// Infer types from Zod schemas — single source of truth
export type UserRole = z.infer<typeof UserRoleSchema>
export type CondoType = z.infer<typeof CondoTypeSchema>

// Auth por senha / JWT
export type LoginInput = z.infer<typeof LoginSchema>
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type RefreshInput = z.infer<typeof RefreshSchema>
