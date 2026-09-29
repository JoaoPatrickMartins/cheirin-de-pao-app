import { z } from 'zod'
import { REFERRAL_REJECT_REASONS } from '../../lib/referral.js'

/** Filtros da lista do A4 (chips). `aguardando` inclui quem ainda está no cadastro. */
export const REFERRAL_LIST_FILTERS = ['analise', 'aguardando', 'ganhou', 'recusada', 'expirou', 'todas'] as const
export type ReferralListFilter = (typeof REFERRAL_LIST_FILTERS)[number]

export const ListReferralsQuerySchema = z.object({
  // Valor desconhecido cai no padrão (Em análise) em vez de 400: é filtro de tela, não dado.
  state: z.enum(REFERRAL_LIST_FILTERS).catch('analise').default('analise'),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).catch(1).default(1),
})

export type ListReferralsQuery = z.infer<typeof ListReferralsQuerySchema>

/** Recusa (D-12): motivo entre os 4 + detalhe obrigatório (só o admin vê). */
export const RejectReferralSchema = z.object({
  reason: z.enum(REFERRAL_REJECT_REASONS, { message: 'Escolha o motivo da recusa' }),
  detail: z.string().trim().min(3, 'Escreva o detalhe da recusa').max(500, 'O detalhe pode ter até 500 caracteres'),
})

export type RejectReferralBody = z.infer<typeof RejectReferralSchema>

/** Vínculo manual (A5) — o código é normalizado pelo service. */
export const LinkReferralSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código').max(20),
})
