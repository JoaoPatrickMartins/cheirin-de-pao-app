import { z } from 'zod'

// Base ID schema — MongoDB ObjectId as 24-char hex string
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId')

// User role enum — matches Prisma UserRole enum values exactly
export const UserRoleSchema = z.enum(['CLIENT', 'COURIER', 'ADMIN'])

// Condominium type enum — matches Prisma CondoType enum values exactly
export const CondoTypeSchema = z.enum(['SINGLE_ENTRANCE', 'BLOCKS'])
