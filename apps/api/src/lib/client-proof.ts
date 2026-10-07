import type { PrismaClient } from '@prisma/client'
import { isProofExpired } from '@cheirin-de-pao/shared'
import { getRouteConfig } from './route-config.js'
import { getSignedReadUrl, isStorageConfigured } from './storage.js'

/**
 * Comprovante da entrega visto pelo CLIENTE (C2 do plano do entregador).
 *
 * Regras que valem em todo lugar onde o cliente vê a foto:
 * - só com o toggle global `fotoClienteVisivel` ligado (D-4);
 * - só foto recebida (`status OK`) e dentro dos 90 dias (D-4b) — depois disso, "expirada";
 * - a foto é PRIVADA: sai como URL assinada de curta duração, e só para o dono do pedido (T-4).
 */

export interface ClientProofFlags {
  /** Há foto para mostrar agora. */
  available: boolean
  /** Houve foto, mas passou dos 90 dias. */
  expired: boolean
}

const NONE: ClientProofFlags = { available: false, expired: false }

type ProofRow = { orderId: string | null; marketOrderIds: string[]; photoAt: Date | null }

function flagsOf(p: ProofRow | undefined, now: Date): ClientProofFlags {
  if (!p) return NONE
  const expired = !!p.photoAt && isProofExpired(p.photoAt, now)
  return { available: !expired, expired }
}

/**
 * Selos de comprovante para uma lista de pedidos (histórico/acompanhamento). Uma consulta só.
 * Com a função desligada, nada aparece — nem "expirada".
 */
export async function proofFlags(
  prisma: Pick<PrismaClient, 'deliveryProof' | 'setting'>,
  ref: { orderIds?: string[]; marketOrderIds?: string[] },
  now: Date = new Date(),
): Promise<{ byOrder: Map<string, ClientProofFlags>; byMarketOrder: Map<string, ClientProofFlags> }> {
  const byOrder = new Map<string, ClientProofFlags>()
  const byMarketOrder = new Map<string, ClientProofFlags>()
  const orderIds = ref.orderIds ?? []
  const marketIds = ref.marketOrderIds ?? []
  if (orderIds.length === 0 && marketIds.length === 0) return { byOrder, byMarketOrder }
  if (!(await getRouteConfig(prisma)).fotoClienteVisivel) return { byOrder, byMarketOrder }

  const or = [
    ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
    ...(marketIds.length ? [{ marketOrderIds: { hasSome: marketIds } }] : []),
  ]
  const rows = await prisma.deliveryProof.findMany({
    where: { status: 'OK', photoKey: { not: null }, OR: or },
    select: { orderId: true, marketOrderIds: true, photoAt: true },
  })
  for (const r of rows) {
    if (r.orderId) byOrder.set(r.orderId, flagsOf(r, now))
    for (const m of r.marketOrderIds) if (marketIds.includes(m)) byMarketOrder.set(m, flagsOf(r, now))
  }
  return { byOrder, byMarketOrder }
}

export interface ClientProofPhoto {
  url: string
  at: string
  outcome: string
}

/**
 * URL assinada da foto de um pedido do próprio cliente. `null` = não há foto para mostrar (função
 * desligada, sem foto, expirada, armazenamento fora ou pedido de outro cliente — o cliente nunca
 * descobre se um pedido alheio existe).
 */
export async function clientProofPhoto(
  prisma: Pick<PrismaClient, 'deliveryProof' | 'setting' | 'order' | 'marketOrder'>,
  userId: string,
  ref: { orderId: string } | { marketOrderId: string },
  now: Date = new Date(),
): Promise<ClientProofPhoto | null> {
  const owner =
    'orderId' in ref
      ? await prisma.order.findUnique({ where: { id: ref.orderId }, select: { userId: true } })
      : await prisma.marketOrder.findUnique({ where: { id: ref.marketOrderId }, select: { userId: true } })
  if (!owner || owner.userId !== userId) return null
  if (!(await getRouteConfig(prisma)).fotoClienteVisivel || !isStorageConfigured()) return null

  const proof = await prisma.deliveryProof.findFirst({
    where: {
      status: 'OK',
      photoKey: { not: null },
      ...('orderId' in ref ? { orderId: ref.orderId } : { marketOrderIds: { has: ref.marketOrderId } }),
    },
    orderBy: { updatedAt: 'desc' },
  })
  if (!proof?.photoKey || !proof.photoAt || isProofExpired(proof.photoAt, now)) return null
  return { url: await getSignedReadUrl(proof.photoKey), at: proof.photoAt.toISOString(), outcome: proof.outcome }
}
