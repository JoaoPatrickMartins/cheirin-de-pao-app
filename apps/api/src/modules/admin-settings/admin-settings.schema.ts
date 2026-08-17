import { z } from 'zod'

/**
 * UpdateSlotsSchema — valida as edições de slots, globais ou de UM condomínio.
 *
 * Sem `condominiumId` = edita o PADRÃO global: time, cutoffTime, label, emoji, isActive.
 * Com `condominiumId` = personaliza aquele condomínio e só `time`/`isActive` são aceitos —
 * `cutoffTime` é sempre global (o pedido ao fornecedor assume um corte por turno) e
 * `label`/`emoji` são identidade visual da operação. `null` = voltar a herdar o global.
 * `name`/`slotId` permanecem imutáveis (identidade) nos dois casos.
 */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** ObjectId do Mongo em hex — mesma validação usada nas rotas que recebem id na query. */
const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'condominiumId inválido')

export const UpdateSlotsSchema = z
  .object({
    condominiumId: ObjectIdSchema.optional(),
    slots: z
      .array(
        z.object({
          slotId: z.string().min(1, 'slotId obrigatório'),
          time: z.string().regex(HHMM, 'Formato inválido. Use HH:MM.').nullable().optional(),
          cutoffTime: z.string().regex(HHMM, 'Formato inválido. Use HH:MM.').optional(),
          label: z.string().min(1).max(40).optional(),
          emoji: z.string().max(8).optional(),
          isActive: z.boolean().nullable().optional(),
        }),
      )
      .min(1, 'Informe ao menos um slot'),
  })
  .superRefine((v, ctx) => {
    if (!v.condominiumId) {
      // No global, `null` não tem de quem herdar.
      for (const s of v.slots) {
        if (s.time === null || s.isActive === null) {
          ctx.addIssue({
            code: 'custom',
            message: 'O padrão global não pode herdar — informe um valor para time/isActive.',
          })
        }
      }
      return
    }
    for (const s of v.slots) {
      if (s.cutoffTime !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'O horário de corte é global e não pode ser definido por condomínio.',
        })
      }
      if (s.label !== undefined || s.emoji !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Rótulo e emoji do turno são globais e não podem ser definidos por condomínio.',
        })
      }
    }
  })

export type UpdateSlotsBody = z.infer<typeof UpdateSlotsSchema>

/**
 * UpdateAvulsoSchema — valida a configuração de compra avulsa.
 */
export const UpdateAvulsoSchema = z.object({
  limit: z.number().int().min(1, 'Limite mínimo é 1'),
  unitPrice: z.number().min(0, 'Preço não pode ser negativo'),
})

export type UpdateAvulsoBody = z.infer<typeof UpdateAvulsoSchema>

/**
 * UpdatePedidoMinimoSchema — valida os pedidos mínimos (agenda por dia + pedido único).
 *
 * - `unico`: mínimo do pedido único (1..20 — casa com o teto do pedido único).
 * - `agenda`: mínimo por dia da semana (0..12 — casa com o teto do StepperInline da agenda).
 *   0 = sem mínimo naquele dia. Aplica-se por turno quando a qtd do dia é > 0.
 */
const WeekdayMinSchema = z.number().int().min(0).max(12)

export const UpdatePedidoMinimoSchema = z.object({
  unico: z.number().int().min(1, 'Mínimo do pedido único é 1').max(20, 'Máximo é 20'),
  agenda: z.object({
    seg: WeekdayMinSchema,
    ter: WeekdayMinSchema,
    qua: WeekdayMinSchema,
    qui: WeekdayMinSchema,
    sex: WeekdayMinSchema,
    sab: WeekdayMinSchema,
    dom: WeekdayMinSchema,
  }),
})

export type UpdatePedidoMinimoBody = z.infer<typeof UpdatePedidoMinimoSchema>
export type WeekdayMinimums = UpdatePedidoMinimoBody['agenda']

/**
 * UpdateGanchoSchema — valida a config do gancho de porta.
 *
 * - `pedidoUnicoMin`: mínimo de pães num pedido único para ganhar o gancho grátis (1..50).
 *   A compra de combo sempre dá direito, independente da quantidade. O mesmo mínimo, convertido
 *   pelo preço avulso, é o limiar em R$ de uma Cestinha.
 * - `preco`: preço de um gancho adicional (reposição por defeito/perda), cobrado via Pix.
 * - `recorrenciaMin`: pedidos ENTREGUES (pedido único + Cestinha) que dão o gancho por
 *   fidelidade; `0` desliga a regra. **Opcional de propósito**: um PWA em cache com a versão
 *   anterior da tela não envia o campo — nesse caso o valor vigente é preservado, em vez de o
 *   admin desligar a regra sem perceber (ou levar 400 e não conseguir salvar nada).
 */
export const UpdateGanchoSchema = z.object({
  pedidoUnicoMin: z.number().int().min(1, 'Mínimo é 1').max(50, 'Máximo é 50'),
  preco: z.number().min(0, 'Preço não pode ser negativo'),
  recorrenciaMin: z.number().int().min(0, 'Mínimo é 0').max(100, 'Máximo é 100').optional(),
})

export type UpdateGanchoBody = z.infer<typeof UpdateGanchoSchema>

/**
 * UpdateRestricoesSchema — valida as restrições de agendamento por dia da semana.
 *
 * - `diasBloqueados`: dia com `true` NÃO aceita entregas (pedido único, agenda e corte).
 * - `limitePedidosDia`: máximo de entregas (pedidos) por dia; `0` = ilimitado.
 *
 * Sem `condominiumId` grava o PADRÃO global. Com `condominiumId` grava o override daquele
 * condomínio, e aí `null` significa "voltar a herdar o padrão". O limite, quando resolvido
 * para um condomínio, conta apenas as entregas DAQUELE condomínio.
 */
const WeekdayBoolSchema = z.object({
  seg: z.boolean(),
  ter: z.boolean(),
  qua: z.boolean(),
  qui: z.boolean(),
  sex: z.boolean(),
  sab: z.boolean(),
  dom: z.boolean(),
})

const WeekdayLimitSchema = z.object({
  seg: z.number().int().min(0).max(9999),
  ter: z.number().int().min(0).max(9999),
  qua: z.number().int().min(0).max(9999),
  qui: z.number().int().min(0).max(9999),
  sex: z.number().int().min(0).max(9999),
  sab: z.number().int().min(0).max(9999),
  dom: z.number().int().min(0).max(9999),
})

export const UpdateRestricoesSchema = z
  .object({
    condominiumId: ObjectIdSchema.optional(),
    diasBloqueados: WeekdayBoolSchema.nullable(),
    limitePedidosDia: WeekdayLimitSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.condominiumId) return
    if (v.diasBloqueados === null || v.limitePedidosDia === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'O padrão global não pode herdar — informe os dois mapas de dias.',
      })
    }
  })

export type UpdateRestricoesBody = z.infer<typeof UpdateRestricoesSchema>

/**
 * CreateDeliveryBlockSchema — bloqueio de uma DATA ou de um PERÍODO.
 *
 * Sem `condominiumId` = bloqueio GLOBAL (todos os condomínios). Datas em "YYYY-MM-DD" (dia BRT),
 * intervalo inclusivo; data única = `startDate === endDate`. A validação de calendário/passado
 * fica em `validateBlockRange` (lib/delivery-rules) — fonte única, compartilhada com os testes.
 *
 * `cancelExisting` decide o que fazer com o que já existe naquelas datas: `false` só impede
 * novos pedidos; `true` cancela Orders/Cestinhas e estorna os créditos.
 */
const DateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use AAAA-MM-DD.')

export const CreateDeliveryBlockSchema = z.object({
  condominiumId: ObjectIdSchema.optional(),
  startDate: DateStrSchema,
  endDate: DateStrSchema,
  reason: z.string().trim().min(1).max(60).optional(),
  cancelExisting: z.boolean().optional(),
})

export type CreateDeliveryBlockBody = z.infer<typeof CreateDeliveryBlockSchema>
