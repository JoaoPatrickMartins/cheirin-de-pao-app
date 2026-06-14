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
    comboId: z.string().optional(),
    customQuantity: z.number().int().positive().optional(),
  })
  .refine((d) => d.comboId || d.customQuantity, {
    message: 'comboId ou customQuantity obrigatório',
  })

export type CreateCardPaymentBody = z.infer<typeof CreateCardPaymentSchema>
