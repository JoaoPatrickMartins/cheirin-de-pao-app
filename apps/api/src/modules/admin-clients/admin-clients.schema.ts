import { z } from 'zod'

/**
 * Schema de validação para operações de admin sobre clientes.
 *
 * BlockClientSchema: body vazio — blockToggle é toggle sem dados adicionais.
 * ClientListQuerySchema: query param opcional para filtro por condomínio.
 */
export const BlockClientSchema = z.object({})
export type BlockClientBody = z.infer<typeof BlockClientSchema>

export const ClientListQuerySchema = z.object({
  condominiumId: z.string().optional(),
})
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>
