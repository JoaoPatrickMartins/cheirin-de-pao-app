import { z } from 'zod'
import { normalizeReferralCode } from '@cheirin-de-pao/shared'

/** Código de indicação com cara de código — o resto é descartado (nunca derruba o pedido). */
const REF_CODE_RE = /^[A-Z0-9]{4,20}$/

/**
 * Corpo de `POST /condominiums/interest` — a lista de espera do cadastro (C8, §7.11).
 *
 * `contact` é o campo único "E-mail ou celular" do handoff (D-15): o service descobre qual é. A
 * forma de cada um é conferida aqui, com a mensagem que a tela mostra embaixo do campo.
 */
export const CondoInterestSchema = z.object({
  condoName: z.string().trim().min(2, 'Informe o nome do condomínio').max(120),
  zip: z
    .string()
    .optional()
    .transform((v) => (v ?? '').replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 8, { message: 'CEP inválido' })
    .transform((v) => v || undefined),
  city: z.string().trim().min(2, 'Informe a cidade').max(80),
  contactName: z.string().trim().min(2, 'Informe seu nome').max(80),
  contact: z.string().trim().min(1, 'Informe um e-mail ou celular').max(120),
  // Veio por indicação? Código adulterado vira "sem código", nunca 400 (mesma regra do cadastro).
  refCode: z
    .string()
    .optional()
    .catch(undefined)
    .transform((v) => {
      const code = normalizeReferralCode(v)
      return REF_CODE_RE.test(code) ? code : undefined
    }),
  visitorId: z.string().max(128).optional().catch(undefined),
})

export type CondoInterestBody = z.infer<typeof CondoInterestSchema>

export const MarkHandledSchema = z.object({
  groupKey: z.string().min(1).max(250),
  handled: z.boolean(),
})
