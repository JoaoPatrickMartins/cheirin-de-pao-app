import type { PrismaClient } from '@prisma/client'
import { brtDateStr } from './cutoff.js'

/**
 * Nº do crachá do entregador (H-3): sequencial e único. O único é o índice PARCIAL
 * `User.badgeNumber_1` (ensure-indexes); aqui o próximo número é o maior + 1, e uma colisão
 * (dois cadastros ao mesmo tempo) tenta de novo com o número seguinte.
 */

type Db = Pick<PrismaClient, 'user'>

const MAX_TRIES = 5

async function maxBadge(prisma: Db): Promise<number> {
  const top = await prisma.user.findFirst({
    where: { role: 'COURIER', badgeNumber: { gt: 0 } },
    orderBy: { badgeNumber: 'desc' },
    select: { badgeNumber: true },
  })
  return top?.badgeNumber ?? 0
}

const isDuplicate = (err: unknown) => (err as { code?: string })?.code === 'P2002' || /duplicate key|E11000/.test(String((err as Error)?.message ?? ''))

/** Dá o próximo número a um entregador que ainda não tem. Devolve o número gravado. */
export async function assignBadgeNumber(prisma: Db, userId: string): Promise<number> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const next = (await maxBadge(prisma)) + 1 + i
    try {
      await prisma.user.update({ where: { id: userId }, data: { badgeNumber: next } })
      return next
    } catch (err) {
      if (!isDuplicate(err)) throw err
    }
  }
  throw new Error('Não foi possível gerar o número do crachá')
}

/**
 * Boot: entregadores sem número ganham um, na ordem de cadastro. Idempotente — quem já tem número
 * não muda, e rodar de novo não faz nada.
 */
export async function backfillBadgeNumbers(prisma: Db): Promise<number> {
  const missing = await prisma.user.findMany({
    where: { role: 'COURIER', OR: [{ badgeNumber: null }, { badgeNumber: { isSet: false } }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  for (const u of missing) await assignBadgeNumber(prisma, u.id)
  return missing.length
}

/** Validade padrão do crachá: 31/12 do ano corrente (V-10), como "YYYY-MM-DD". */
export function defaultBadgeValidity(now: Date = new Date()): string {
  return `${brtDateStr(now).slice(0, 4)}-12-31`
}

/** "YYYY-MM-DD" ⇄ DateTime: guardado ao meio-dia BRT, lido como o dia BRT. */
export function validityToDate(day: string): Date {
  return new Date(`${day}T15:00:00.000Z`)
}
export function validityToDay(d: Date | null | undefined): string | null {
  return d ? brtDateStr(d) : null
}
