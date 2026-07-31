import { z } from 'zod'

/**
 * Schema de validação para criação de fornecedor.
 * T-07-03-02: CNPJ validado com 14 dígitos antes de chegar ao service.
 * T-07-03-03: isPrincipal default false — lógica de único principal no service.
 */
/**
 * Matriz de fornecimento (D-7/D-8): quais produtos um fornecedor fornece, por quanto e com que
 * fatia padrão da demanda. A EXISTÊNCIA da linha é a afirmação "fornece" — enviar a lista completa
 * (PUT) substitui o conjunto; produto ausente deixa de ser fornecido.
 */
export const SetSupplierProductsSchema = z.object({
  products: z
    .array(
      z.object({
        productId: z.string().min(1, 'productId é obrigatório'),
        unitCost: z.number().positive('O custo tem de ser maior que zero'),
        defaultSharePct: z.number().int().min(0).max(100).default(0),
        isPreferred: z.boolean().default(false),
        minOrderQty: z.number().int().min(0).nullable().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .max(200),
})
export type SetSupplierProductsBody = z.infer<typeof SetSupplierProductsSchema>

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
