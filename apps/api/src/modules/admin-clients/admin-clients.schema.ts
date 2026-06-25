import { z } from 'zod'
import { CpfSchema, PhoneSchema } from '@cheirin-de-pao/shared'

/**
 * Schema de validação para operações de admin sobre clientes.
 *
 * BlockClientSchema: body vazio — blockToggle é toggle sem dados adicionais.
 * ClientListQuerySchema: query param opcional para filtro por condomínio.
 * GrantCreditsSchema: body para concessão manual de créditos.
 */
export const BlockClientSchema = z.object({})
export type BlockClientBody = z.infer<typeof BlockClientSchema>

export const ClientListQuerySchema = z.object({
  condominiumId: z.string().optional(),
  q: z.string().optional(),
  status: z.enum(['all', 'blocked', 'active', 'no-credits']).optional().default('all'),
  sort: z.enum(['name', 'credits', 'lastPurchase', 'recent']).optional().default('name'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>

/**
 * GrantCreditsSchema — body para POST /admin/clients/:id/grant-credits.
 *
 * T-10-02-02: quantity int min 1 — Zod rejeita 0 ou negativo.
 * T-10-02-03: reason enum com 4 valores fixos — valores arbitrários rejeitados.
 * adminId vem do JWT (request.user.id) — nunca do body.
 */
export const GrantCreditsSchema = z.object({
  quantity: z.number().int().min(1),
  reason: z.enum(['Acerto', 'Bonificação', 'Compensação', 'Promoção']),
})
export type GrantCreditsBody = z.infer<typeof GrantCreditsSchema>

/**
 * UpdateClientSchema — body para PATCH /admin/clients/:id (edição de cadastro).
 *
 * Todos os campos opcionais (atualização parcial). CPF e telefone normalizados
 * pelos schemas compartilhados. e-mail validado. birthDate aceita ISO ou ''
 * (string vazia → limpa o campo). Pelo menos um campo deve ser enviado.
 */
export const UpdateClientSchema = z
  .object({
    name: z.string().min(2, 'Nome muito curto').optional(),
    phone: PhoneSchema.optional(),
    email: z.string().email('E-mail inválido').optional(),
    cpf: CpfSchema.optional(),
    birthDate: z.union([z.string().datetime(), z.literal('')]).optional(),
    condominiumId: z.string().optional(),
    apartment: z.string().optional(),
    block: z.string().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' })
export type UpdateClientBody = z.infer<typeof UpdateClientSchema>
