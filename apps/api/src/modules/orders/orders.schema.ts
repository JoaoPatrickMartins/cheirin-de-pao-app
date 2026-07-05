import { z } from 'zod'

/**
 * Schema de validação para criação de pedido avulso.
 * SCHED-01 — Pedido único com reserva atômica de créditos.
 *
 * Threat register:
 * - T-04-03-03: quantity validado como int 1..20 (Zod impede adulteração)
 * - T-04-03-02: scheduledDate validado como string datetime (formato ISO)
 */
export const CreateOrderSchema = z.object({
  quantity: z
    .number()
    .int('Quantidade deve ser inteiro')
    .min(1, 'Mínimo de 1 pão')
    .max(20, 'Máximo de 20 pães por pedido'),
  // Data-only "YYYY-MM-DD" — alinhado ao schema da rota (format: date) e ao que o
  // frontend (DateChips) envia. O `.datetime()` anterior rejeitava o formato real → avulso quebrado.
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de entrega deve estar no formato AAAA-MM-DD' }),
  // Horário do slot escolhido ("HH:MM"). Opcional para condomínios sem slots configurados;
  // quando o condomínio tem slots ativos, o service exige que corresponda a um deles.
  deliveryTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { message: 'Horário do slot deve estar no formato HH:MM' })
    .optional(),
  // Vínculo leve ao pagamento que financiou este avulso — enviado só no fluxo
  // "precisa pagar" (paga o déficit → cria o pedido). Permite ao admin oferecer
  // estorno de dinheiro a partir de um pedido parado. Ausente quando pago via saldo.
  paymentId: z.string().optional(),
})

export type CreateOrderBody = z.infer<typeof CreateOrderSchema>
