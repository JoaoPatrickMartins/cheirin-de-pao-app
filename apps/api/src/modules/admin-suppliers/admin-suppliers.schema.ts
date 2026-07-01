import { z } from 'zod'

/**
 * Schema de validação para criação de fornecedor.
 * T-07-03-02: CNPJ validado com 14 dígitos antes de chegar ao service.
 * T-07-03-03: isPrincipal default false — lógica de único principal no service.
 */
export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional(),
  pricePerUnit: z.number().min(0, 'Preço por unidade deve ser >= 0'),
  isPrincipal: z.boolean().default(false),
  address: z.object({
    street: z.string().min(1, 'Rua é obrigatória'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    city: z.string().min(1, 'Cidade é obrigatória'),
    state: z.string().min(2, 'Estado é obrigatório').max(2, 'Estado deve ter 2 caracteres'),
    zip: z.string().min(1, 'CEP é obrigatório'),
  }),
})

export type CreateSupplierBody = z.infer<typeof CreateSupplierSchema>

export const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
  // Ativar/desativar o fornecedor. Só editável via update.
  isActive: z.boolean().optional(),
})
export type UpdateSupplierBody = z.infer<typeof UpdateSupplierSchema>
