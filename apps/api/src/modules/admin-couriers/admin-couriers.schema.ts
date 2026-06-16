import { z } from 'zod'

/**
 * Schema de validação para criação de entregador.
 * T-07-03-02: CPF validado com 11 dígitos antes de chegar ao service.
 * CPF é imutável após criação — não incluso no UpdateCourierSchema.
 */
export const CreateCourierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional(),
})

export type CreateCourierBody = z.infer<typeof CreateCourierSchema>

// CPF não está no UpdateCourierSchema pois é imutável
export const UpdateCourierSchema = CreateCourierSchema.omit({ cpf: true }).partial()
export type UpdateCourierBody = z.infer<typeof UpdateCourierSchema>
