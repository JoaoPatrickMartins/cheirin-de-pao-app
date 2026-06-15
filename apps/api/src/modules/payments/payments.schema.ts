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
    token: z.string().min(1),
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
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
  })
  .refine((d) => d.comboId || d.customQuantity, {
    message: 'comboId ou customQuantity obrigatório',
  })

export type CreateCardPaymentBody = z.infer<typeof CreateCardPaymentSchema>
