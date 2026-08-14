import { z } from 'zod'
import { COMPLEMENT_MAX_LENGTH } from '@cheirin-de-pao/shared'

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  birthDate: z.string().datetime().optional(),
  condominiumId: z.string().optional(),
  apartment: z.string().optional(),
  block: z.string().optional(),
  // String vazia é aceita de propósito: é como o cliente APAGA o complemento.
  complement: z.string().trim().max(COMPLEMENT_MAX_LENGTH).optional(),
})

export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>

// Apenas troca de e-mail por enquanto (OTP só por e-mail). A edição de
// telefone volta quando o OTP por WhatsApp for implementado.
export const ContactChangeRequestSchema = z.object({
  email: z.string().email(),
})

export type ContactChangeRequestBody = z.infer<typeof ContactChangeRequestSchema>

export const ContactChangeConfirmSchema = z.object({
  code: z.string().length(4),
})

export type ContactChangeConfirmBody = z.infer<typeof ContactChangeConfirmSchema>
