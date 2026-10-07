import type { PrismaClient } from '@prisma/client'
import { brtDateStr, brtDayRange, brtNoonFromStr } from '../../lib/cutoff.js'
import { firstDeliveryDayByUser } from '../../lib/first-delivery.js'
import { resolveCourierRules } from '../../lib/courier-profile.js'

/**
 * A PARADA do entregador: cliente + condomínio + turno + dia. Pão e Cestinha do mesmo cliente no
 * mesmo turno são uma parada só (o entregador toca a campainha uma vez).
 *
 * Aqui mora o "resumo da parada" que o pop-up do scan mostra (E4 do plano do entregador) e o
 * registro do comprovante (`DeliveryProof`). O resumo vem do SERVIDOR, não da lista do aparelho:
 * se a lista estiver velha (entrega atribuída depois), o pop-up ainda mostra o apto certo.
 */

export interface StopSummary {
  /** `HOOK` = parada só de gancho (sem pão nem Cestinha no turno). */
  kind: 'BREAD' | 'MARKET' | 'HOOK'
  /** Pedido de pão da parada (null em parada só-Cestinha e só de gancho). */
  orderId: string | null
  /** O gancho da parada só de gancho. */
  hookId?: string
  marketOrderIds: string[]
  clientName: string
  condominiumId: string | null
  condominiumName: string
  block: string | null
  complement: string | null
  apartment: string
  /** Pães da parada: o pedido de pão + os pães das Cestinhas. */
  quantity: number
  marketItems: Array<{ name: string; qty: number }>
  isFirstOrder: boolean
  /** O cliente já tem gancho de porta. */
  hasHook: boolean
  /** Gancho enviado NESTA rota (F-5) — o pop-up pergunta "Deixou o gancho também?". */
  hookToDeliver: { id: string } | null
  /** Status do pão (ou da Cestinha, em parada só-Cestinha). */
  status: string
  deliveredAt: string | null
  failedAt: string | null
  /** A regra do entregador exige foto neste desfecho. */
  proofRequired: boolean
}

type Prisma = PrismaClient

/** Escopo da parada a partir de um pedido (pão ou Cestinha). */
export interface StopScope {
  courierId: string
  userId: string
  slotId: string
  scheduledDate: Date
}

/**
 * Horário real do desfecho vindo da fila offline (T-7). Limitado a [início do dia BRT, agora]:
 * relógio adiantado não marca entrega no futuro, e fila velha não marca entrega em outro dia.
 */
export function clampOccurredAt(raw: string | undefined, now: Date = new Date()): Date | null {
  if (!raw) return null
  const t = new Date(raw)
  if (Number.isNaN(t.getTime())) return null
  if (t > now) return now
  const { start } = brtDayRange(now)
  return t < start ? start : t
}

/** Cestinhas da parada (mesmo cliente, turno, dia e entregador), em qualquer status de rota. */
async function stopMarketOrders(prisma: Prisma, scope: StopScope) {
  const { start, end } = brtDayRange(scope.scheduledDate)
  return prisma.marketOrder.findMany({
    where: {
      userId: scope.userId,
      slotId: scope.slotId,
      courierId: scope.courierId,
      scheduledDate: { gte: start, lte: end },
      status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] },
    },
    select: { id: true, breadQty: true, status: true, deliveredAt: true, failedAt: true, items: { select: { name: true, qty: true } } },
  })
}

/** Parada só de gancho: o gancho e o desfecho dela (`OUT_FOR_DELIVERY` enquanto pendente). */
export interface HookStopState {
  id: string
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'NOT_DELIVERED'
  deliveredAt: Date | null
  failedAt: Date | null
}

/**
 * Monta o resumo da parada. `bread` é o pedido de pão quando a parada tem um; sem ele, os dados
 * de status/horário vêm da Cestinha. `hookOnly` = parada só de gancho (sem pão nem Cestinha).
 */
export async function buildStopSummary(
  prisma: Prisma,
  scope: StopScope,
  bread: { id: string; quantity: number; status: string; deliveredAt: Date | null; failedAt: Date | null } | null,
  outcome: 'DELIVERED' | 'NOT_DELIVERED' = 'DELIVERED',
  hookOnly: HookStopState | null = null,
): Promise<StopSummary> {
  const date = brtDateStr(scope.scheduledDate)
  const [user, courier, market, firstDays, hook, hookOnRoute] = await Promise.all([
    prisma.user.findUnique({
      where: { id: scope.userId },
      select: { name: true, condominiumId: true, apartment: true, block: true, complement: true },
    }),
    prisma.user.findUnique({ where: { id: scope.courierId }, select: { courierRules: true } }),
    hookOnly ? Promise.resolve([] as Awaited<ReturnType<typeof stopMarketOrders>>) : stopMarketOrders(prisma, scope),
    firstDeliveryDayByUser(prisma, [scope.userId]),
    prisma.hookRequest.findFirst({ where: { userId: scope.userId, status: 'DELIVERED' }, select: { id: true } }),
    // Na parada só de gancho o próprio gancho é a entrega — não há "deixou o gancho também?".
    hookOnly
      ? Promise.resolve(null)
      : prisma.hookRequest.findFirst({
          where: { userId: scope.userId, status: 'REQUESTED', routeDate: date, routeSlotId: scope.slotId },
          select: { id: true },
        }),
  ])
  const condominium = user?.condominiumId
    ? await prisma.condominium.findUnique({ where: { id: user.condominiumId }, select: { name: true } })
    : null

  const rules = resolveCourierRules(courier?.courierRules)
  const items = market.flatMap((m) => m.items.map((i) => ({ name: i.name, qty: i.qty })))
  const first = market[0]
  const status = hookOnly?.status ?? bread?.status ?? first?.status ?? 'OUT_FOR_DELIVERY'
  const deliveredAt = hookOnly ? hookOnly.deliveredAt : bread?.deliveredAt ?? first?.deliveredAt ?? null
  const failedAt = hookOnly ? hookOnly.failedAt : bread?.failedAt ?? first?.failedAt ?? null

  return {
    kind: hookOnly ? 'HOOK' : bread ? 'BREAD' : 'MARKET',
    orderId: bread?.id ?? null,
    ...(hookOnly ? { hookId: hookOnly.id } : {}),
    marketOrderIds: market.map((m) => m.id),
    clientName: user?.name ?? 'Cliente',
    condominiumId: user?.condominiumId ?? null,
    condominiumName: condominium?.name ?? 'Condomínio',
    block: user?.block ?? null,
    complement: user?.complement ?? null,
    apartment: user?.apartment ?? '',
    quantity: (bread?.quantity ?? 0) + market.reduce((n, m) => n + m.breadQty, 0),
    marketItems: items,
    isFirstOrder: firstDays.get(scope.userId) === date,
    hasHook: !!hook,
    hookToDeliver: hookOnRoute ? { id: hookOnRoute.id } : null,
    status,
    deliveredAt: deliveredAt ? deliveredAt.toISOString() : null,
    failedAt: failedAt ? failedAt.toISOString() : null,
    proofRequired: outcome === 'DELIVERED' ? rules.fotoEntrega : rules.fotoNaoEntrega,
  }
}

/** Chave única do comprovante da parada (`@@unique` do DeliveryProof). */
function proofKey(scope: StopScope, outcome: 'DELIVERED' | 'NOT_DELIVERED') {
  return {
    courierId: scope.courierId,
    userId: scope.userId,
    slotId: scope.slotId,
    date: brtDateStr(scope.scheduledDate),
    outcome,
  }
}

/** Último `clientOpId` registrado para o desfecho da parada (idempotência da fila offline). */
export async function lastClientOpId(
  prisma: Prisma,
  scope: StopScope,
  outcome: 'DELIVERED' | 'NOT_DELIVERED',
): Promise<string | null> {
  const proof = await prisma.deliveryProof.findUnique({
    where: { courierId_userId_slotId_date_outcome: proofKey(scope, outcome) },
    select: { lastClientOpId: true },
  })
  return proof?.lastClientOpId ?? null
}

/**
 * Registra o desfecho da parada no comprovante (status PENDING até a foto chegar — Onda 3).
 * Sem condomínio conhecido não há como montar a parada: não registra (não trava a entrega).
 */
export async function recordStopOutcome(
  prisma: Prisma,
  scope: StopScope,
  outcome: 'DELIVERED' | 'NOT_DELIVERED',
  data: {
    condominiumId: string | null
    orderId: string | null
    marketOrderIds: string[]
    /** Parada só de gancho: o gancho entregue (ou não). */
    hookRequestId?: string | null
    required: boolean
    confirmedVia?: string | null
    clientOpId?: string | null
  },
): Promise<void> {
  if (!data.condominiumId) return
  const key = proofKey(scope, outcome)
  // Só grava o campo quando há gancho: parada de pão fica sem a chave (não vira `null` explícito).
  const hook = data.hookRequestId ? { hookRequestId: data.hookRequestId } : {}
  await prisma.deliveryProof.upsert({
    where: { courierId_userId_slotId_date_outcome: key },
    create: {
      ...key,
      condominiumId: data.condominiumId,
      orderId: data.orderId,
      marketOrderIds: data.marketOrderIds,
      ...hook,
      required: data.required,
      status: 'PENDING',
      confirmedVia: data.confirmedVia ?? null,
      lastClientOpId: data.clientOpId ?? null,
    },
    update: {
      orderId: data.orderId,
      marketOrderIds: data.marketOrderIds,
      ...hook,
      confirmedVia: data.confirmedVia ?? null,
      lastClientOpId: data.clientOpId ?? null,
    },
  })
}

// ── Comprovante (foto) — Onda 3 ────────────────────────────────────────────

/**
 * Localiza a PARADA pela chave que o app tem: o id do pedido de pão, de uma Cestinha da parada ou,
 * na parada só de gancho, do gancho. Valida o dono (403) e devolve o escopo da parada.
 *
 * @throws { statusCode: 404 } chave desconhecida
 * @throws { statusCode: 403 } parada de outro entregador
 */
export async function resolveStopByKey(prisma: Prisma, courierId: string, key: string): Promise<{ scope: StopScope }> {
  const order = await prisma.order.findUnique({
    where: { id: key },
    select: { userId: true, slotId: true, scheduledDate: true, courierId: true },
  })
  const found = order
    ? { ...order, slotId: order.slotId ?? '' }
    : (await prisma.marketOrder.findUnique({
        where: { id: key },
        select: { userId: true, slotId: true, scheduledDate: true, courierId: true },
      })) ?? (await hookStopByKey(prisma, courierId, key))
  if (!found) throw { statusCode: 404, message: 'Parada não encontrada' }
  if (found.courierId !== courierId) throw { statusCode: 403, message: 'Acesso negado: esta entrega nao pertence a voce' }
  return { scope: { courierId, userId: found.userId, slotId: found.slotId, scheduledDate: found.scheduledDate } }
}

/**
 * Parada só de gancho pela chave do gancho: o comprovante mais recente do desfecho dela. A foto vem
 * depois do desfecho, então o comprovante já existe (o gancho que volta para a fila perde o
 * `routeCourierId`, e por isso o dono sai do comprovante, não do gancho).
 */
async function hookStopByKey(prisma: Prisma, courierId: string, hookId: string) {
  const proof = await prisma.deliveryProof.findFirst({
    where: { hookRequestId: hookId },
    orderBy: { updatedAt: 'desc' },
    select: { userId: true, slotId: true, date: true, courierId: true },
  })
  if (!proof) return null
  return { userId: proof.userId, slotId: proof.slotId, scheduledDate: brtNoonFromStr(proof.date), courierId: proof.courierId as string | null }
}

export type ProofView = { status: string; required: boolean; outcome: string; photoAt: string | null; note: string | null }

function toView(p: { status: string; required: boolean; outcome: string; photoAt: Date | null; note: string | null }): ProofView {
  return { status: p.status, required: p.required, outcome: p.outcome, photoAt: p.photoAt ? p.photoAt.toISOString() : null, note: p.note }
}

/** Comprovante da parada no desfecho, ou 404 (a parada ainda não teve esse desfecho). */
async function findProof(prisma: Prisma, scope: StopScope, outcome: 'DELIVERED' | 'NOT_DELIVERED') {
  const proof = await prisma.deliveryProof.findUnique({
    where: { courierId_userId_slotId_date_outcome: proofKey(scope, outcome) },
  })
  if (!proof) throw { statusCode: 404, message: 'Essa parada ainda não foi confirmada' }
  return proof
}

/**
 * Grava a foto (chave privada no S3) — repetir substitui a anterior (idempotente para a fila).
 *
 * NÃO mexe no `lastClientOpId`: ele é o id da operação do DESFECHO (confirmação/não entrega). Se a
 * foto o trocasse, o reenvio atrasado da confirmação pela fila offline viraria 409 em vez de
 * sucesso (T-7).
 */
export async function saveProofPhoto(
  prisma: Prisma,
  scope: StopScope,
  outcome: 'DELIVERED' | 'NOT_DELIVERED',
  photoKey: string,
): Promise<ProofView> {
  const proof = await findProof(prisma, scope, outcome)
  const updated = await prisma.deliveryProof.update({
    where: { id: proof.id },
    data: { status: 'OK', photoKey, photoAt: new Date(), note: null },
  })
  return toView(updated)
}

/**
 * Sem foto: `NONE` = exceção da foto obrigatória (motivo obrigatório); `SKIPPED` = o entregador
 * não é obrigado e pulou. Foto já recebida não é sobrescrita por um "pular" atrasado da fila.
 *
 * @throws { statusCode: 422 } pular quando a foto é obrigatória
 */
export async function skipProof(
  prisma: Prisma,
  scope: StopScope,
  outcome: 'DELIVERED' | 'NOT_DELIVERED',
  mode: 'NONE' | 'SKIPPED',
  note: string | null,
): Promise<ProofView> {
  const proof = await findProof(prisma, scope, outcome)
  if (proof.status === 'OK') return toView(proof)
  if (mode === 'SKIPPED' && proof.required) {
    throw { statusCode: 422, message: 'A foto é obrigatória para você. Se não der, use "Não consigo tirar a foto".' }
  }
  const updated = await prisma.deliveryProof.update({ where: { id: proof.id }, data: { status: mode, note } })
  return toView(updated)
}
