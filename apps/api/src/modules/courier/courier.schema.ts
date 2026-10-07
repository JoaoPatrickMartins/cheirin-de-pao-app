import type { CondoAccess } from '@cheirin-de-pao/shared'
import { z } from 'zod'
import { ACCESS_FIELDS, FAILURE_CODES, INCIDENT_TYPES, NO_PHOTO_REASONS, RECADO_TEMPLATES, SHIFT_DECLINE_REASONS, STOP_ISSUE_TYPES } from '@cheirin-de-pao/shared'

/**
 * Schema de validacao dos params de confirmacao de entrega.
 * T-06-01: orderId validado no schema; courierId extraido do JWT (nunca do body).
 * D-12: PATCH /courier/orders/:id/confirm — id vem da URL.
 */
export const ConfirmDeliveryParams = z.object({
  id: z.string().min(1, 'ID do pedido e obrigatorio'),
})

export type ConfirmDeliveryParamsType = z.infer<typeof ConfirmDeliveryParams>

/**
 * Body de PATCH .../not-delivered (E6). `failureCode` = motivo padronizado (M-4); `reason` = texto,
 * obrigatório em "Outro". O app antigo manda só `{ reason }` — vira "Outro" no service.
 * `via`/`clientOpId`/`occurredAt` como na confirmação.
 */
export const NotDeliveredBody = z
  .object({
    failureCode: z.enum(FAILURE_CODES).optional(),
    reason: z.string().max(500).optional(),
    via: z.enum(['SCAN', 'CODE', 'LIST']).optional(),
    clientOpId: z.string().min(8).max(64).optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((d) => d.failureCode !== 'OUTRO' || (d.reason?.trim().length ?? 0) >= 3, {
    message: 'Escreva o motivo para seguir',
  })

export type NotDeliveredBodyType = z.infer<typeof NotDeliveredBody>

/**
 * Body OPCIONAL da confirmação (o app antigo manda PATCH sem corpo).
 * - via: como foi confirmada (T-17);
 * - clientOpId: id da operação na fila offline — reenvio da mesma operação não vira "já confirmada";
 * - occurredAt: horário real do desfecho (fila offline), limitado ao dia no servidor.
 */
export const ConfirmBody = z.object({
  via: z.enum(['SCAN', 'CODE', 'LIST']).optional(),
  clientOpId: z.string().min(8).max(64).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
})

export type ConfirmBodyType = z.infer<typeof ConfirmBody>

/** Desfecho da parada a que o comprovante pertence. */
export const ProofOutcome = z.enum(['DELIVERED', 'NOT_DELIVERED'])

/** POST /courier/stops/:key/proof?outcome=&clientOpId= (multipart `file`). */
export const ProofQuery = z.object({
  outcome: ProofOutcome,
  clientOpId: z.string().min(8).max(64).optional(),
})

/**
 * POST /courier/stops/:key/proof/skip — seguir sem foto. `NONE` (exceção da obrigatória) exige
 * o motivo; "Outro" exige o texto. `SKIPPED` = opcional, pulou.
 */
export const ProofSkipBody = z
  .object({
    outcome: ProofOutcome,
    mode: z.enum(['NONE', 'SKIPPED']),
    reasonCode: z.enum(NO_PHOTO_REASONS).optional(),
    text: z.string().max(200).optional(),
  })
  .refine((d) => d.mode !== 'NONE' || !!d.reasonCode, { message: 'Escolha o motivo para seguir sem foto' })
  .refine((d) => d.reasonCode !== 'OUTRO' || (d.text?.trim().length ?? 0) >= 3, { message: 'Conte o que aconteceu' })

/** GET /courier/stops/lookup?code= — o formato fino (4 ou 6 hex) é validado no service. */
export const LookupQuery = z.object({
  code: z.string().min(1, 'Informe o código do cupom').max(12),
})

/**
 * Tipo de resposta de GET /courier/orders/today.
 *
 * Agrupa ordens por condominio com paradas ordenadas por apartamento numerico.
 * route e null quando OSRM falha (graceful degradation — D-07).
 */
export type TodayOrdersResponse = {
  condos: Array<{
    condominiumId: string
    condominiumName: string
    address: string
    lat: number | null
    lng: number | null
    /** Dicas de acesso para o entregador (A6/E7); null = nenhuma dica ainda. */
    access: CondoAccess | null
    stops: Array<{
      orderId: string
      apartment: string
      block: string | null
      /** Complemento do bloco ("Lado A"); null quando não há. */
      complement: string | null
      clientName: string
      quantity: number
      status: string
      sortKey: number
      // Turno (slot) da entrega — deixa claro manhã/tarde por pedido (entregador pode
      // ter ambos os turnos no mesmo dia).
      slotId: string
      slotLabel: string
      // Mini market ("Além do Pãozin") que pega carona nesta parada.
      marketOrderId?: string // presente em parada SÓ-market (sem pedido de pão)
      /** Todas as Cestinhas da parada (cliente + turno). Vazio em parada só de pão. */
      marketOrderIds: string[]
      marketItems: Array<{ name: string; qty: number }>
      marketItemCount: number
      /** 1ª entrega do cliente (selo ✨). */
      isFirstOrder: boolean
      /** O cliente já tem gancho de porta. */
      hasHook: boolean
      /** Gancho enviado nesta rota (A7) — o entregador confirma se deixou. */
      hookToDeliver: { id: string } | null
      /** Parada SÓ de gancho (sem pão nem Cestinha): o gancho é a entrega. `orderId` vem vazio. */
      hookId?: string
      /** O cliente desligou os recados do entregador (E16 fica bloqueado). */
      messagesOff: boolean
    }>
  }>
  totalStops: number
  totalBreads: number
  totalItems: number
  // Uma rota por turno (manhã e tarde não se misturam), na ordem de `slots`; paradas sem turno
  // (legado) entram com slotId ''. `route` é null quando o OSRM falha ou há menos de 2
  // condomínios localizados no turno.
  routes: Array<{
    slotId: string
    label: string
    emoji: string
    time: string
    /** Prédios do turno na ordem do dia (inclui os já feitos). */
    condominiumIds: string[]
    route: { distanceKm: string; durationMin: number; geometry: Array<[number, number]> } | null
    /** pronta (não iniciada) · em_rota · encerrada */
    state: 'pronta' | 'em_rota' | 'encerrada'
    run: { id: string; startedAt: string | null; endedAt: string | null; startMode: string | null } | null
    /** O entregador mudou a ordem hoje (vale só hoje). */
    reorderedToday: boolean
    /** Hora prevista (HH:MM, BRT) de cada prédio: trajeto + tempo por porta. null = sem mapa. */
    eta: Array<{ condominiumId: string; time: string | null }>
  }>
  // Turnos presentes na rota de hoje (distintos, ordenados por horário) — usado no
  // cabeçalho do app do entregador para informar turno + horário.
  slots: Array<{ slotId: string; label: string; emoji: string; time: string }>
  // Entregas já concluídas hoje (DELIVERED/NOT_DELIVERED), agrupadas por condomínio e
  // ordenadas por bloco/apartamento — alimenta a aba "Realizadas".
  completed: Array<{
    condominiumId: string
    condominiumName: string
    stops: Array<{
      orderId: string
      apartment: string
      block: string | null
      /** Complemento do bloco ("Lado A"); null quando não há. */
      complement: string | null
      clientName: string
      quantity: number
      status: string
      slotId: string
      slotLabel: string
      // Instante da conclusão (deliveredAt ou failedAt) em ISO 8601; null se ausente.
      completedAt: string | null
      marketOrderId?: string
      marketOrderIds: string[]
      marketItems: Array<{ name: string; qty: number }>
      marketItemCount: number
      /** Parada só de gancho (ver `condos[].stops[].hookId`). */
      hookId?: string
      /** Comprovante da parada (PENDING | OK | NONE | SKIPPED); null sem registro (pedido antigo). */
      proofStatus: string | null
      /** O entregador já reportou problema nesta parada (E11). */
      reported: boolean
    }>
  }>
  completedTotal: number
  /** Regras do entregador definidas pelo admin (foto obrigatória, reordenar, recados). */
  rules: { fotoEntrega: boolean; fotoNaoEntrega: boolean; podeReordenar: boolean; podeRecados: boolean }
  /** Base de saída (A5); null = não definida (a rota começa no primeiro prédio). */
  base: { endereco: string; lat: number; lng: number } | null
  /** Todos os prédios das rotas (inclusive os só concluídos), com coordenada para o mapa. */
  routeCondos: Array<{ condominiumId: string; condominiumName: string; lat: number | null; lng: number | null }>
}

/** POST /courier/runs/start */
export const StartRunBody = z.object({
  slotId: z.string().min(1).max(40),
  startMode: z.enum(['BASE', 'GPS']),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

/** POST /courier/runs/:id/position */
export const PositionBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/** PUT /courier/runs/order */
export const ReorderBody = z.object({
  slotId: z.string().min(1).max(40),
  condominiumIds: z.array(z.string().regex(/^[0-9a-f]{24}$/i, 'Prédio inválido')).min(1).max(100),
})

export const SlotQuery = z.object({ slotId: z.string().min(1).max(40) })
export const RunParams = z.object({ id: z.string().regex(/^[0-9a-f]{24}$/i, 'Rota inválida') })
export const SlotParams = z.object({ slotId: z.string().min(1).max(40) })

// ── Operação do entregador (Onda 8) ──────────────────────────────────────────

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Id inválido')
const opId = z.string().min(8).max(64).optional()

/** POST /courier/messages — E16 (recado pronto, T-16). */
export const MessageBody = z.object({
  stopKey: objectId,
  template: z.enum(RECADO_TEMPLATES.map((r) => r.key) as [string, ...string[]]),
  clientOpId: opId,
})

/** POST /courier/reports — E11 (problema na entrega) e E12 (ocorrência). */
export const ReportBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('STOP_ISSUE'), stopKey: objectId, type: z.enum(STOP_ISSUE_TYPES), text: z.string().max(500).nullish(), clientOpId: opId }),
  z.object({
    kind: z.literal('INCIDENT'),
    type: z.enum(INCIDENT_TYPES),
    text: z.string().max(500).nullish(),
    photoKey: z.string().max(120).nullish(),
    clientOpId: opId,
  }),
])

/** POST /courier/condos/:id/access-suggestions — E7. */
export const AccessSuggestionBody = z.object({
  field: z.enum(ACCESS_FIELDS),
  text: z.string().trim().min(3, 'Escreva a sugestão').max(300),
})
export const IdParams = z.object({ id: objectId })

/** POST /courier/hooks/:id/outcome — A7 ("Deixou o gancho também?"). */
export const HookOutcomeBody = z.object({ delivered: z.boolean() })

/** POST /courier/terms/accept — Termo do Entregador Parceiro (plano-termos-legais §6). */
export const AcceptTermsBody = z.object({ version: z.string().trim().min(1).max(20) })

/** POST /courier/shifts/:id/decline — motivo OPCIONAL (recusar não exige justificativa). */
export const DeclineShiftBody = z.object({
  reason: z
    .enum(SHIFT_DECLINE_REASONS.map((r) => r.key) as [string, ...string[]])
    .nullish(),
})
