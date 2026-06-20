import { z } from 'zod'

export const CreatePixPaymentSchema = z
  .object({
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
  })
  .refine((d) => d.comboId || d.customQuantity, {
    message: 'comboId ou customQuantity obrigatório',
  })

export type CreatePixPaymentBody = z.infer<typeof CreatePixPaymentSchema>

export const CreateCardPaymentSchema = z
  .object({
    // ── Novo cartão via MP Brick ─────────────────────────────────────────
    token: z.string().min(1).optional(),
    installments: z.number().int().positive().default(1),
    issuerId: z.string().optional(),
    // Obrigatório pelo MP para cartão (ex.: "master", "visa"); vem do Brick.
    paymentMethodId: z.string().optional(),
    // E-mail do pagador informado no formulário do Brick. Em teste, precisa ser
    // diferente do e-mail da conta MP (senão o MP acusa "uma das partes é de teste").
    // E-mail inválido vira undefined (cai no fallback do service) — nunca derruba o pagamento.
    payerEmail: z.string().email().optional().catch(undefined),
    // Identificação do pagador (CPF) — exigida pelo MP em produção no Brasil; vem do Brick.
    payerIdentification: z
      .object({ type: z.string(), number: z.string() })
      .optional()
      .catch(undefined),
    // ── Cartão salvo (CARD-06) ───────────────────────────────────────────
    // savedCardId presente → usa CartToken.create; token não obrigatório neste caso
    savedCardId: z.string().optional(),
    // CVV — necessário para reautenticar cartão salvo (D-16: CVV obrigatório por transação)
    securityCode: z.string().optional(),
    // Salvar cartão após pagamento bem-sucedido (CARD-02)
    saveCard: z.boolean().optional().default(false),
    // ── Valor ────────────────────────────────────────────────────────────
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
  })
  .refine((d) => d.comboId || d.customQuantity, {
    message: 'comboId ou customQuantity obrigatório',
  })
  .refine((d) => d.token || d.savedCardId, {
    message: 'token (novo cartão) ou savedCardId (cartão salvo) obrigatório',
  })

export type CreateCardPaymentBody = z.infer<typeof CreateCardPaymentSchema>
