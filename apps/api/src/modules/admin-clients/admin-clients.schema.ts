import { z } from 'zod'

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
