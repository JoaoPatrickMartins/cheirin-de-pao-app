import { z } from 'zod'
import { UserRoleSchema, CondoTypeSchema } from '../schemas'

// Base ID type — MongoDB ObjectId as string
export type ID = string

// Infer types from Zod schemas — single source of truth
export type UserRole = z.infer<typeof UserRoleSchema>
export type CondoType = z.infer<typeof CondoTypeSchema>
