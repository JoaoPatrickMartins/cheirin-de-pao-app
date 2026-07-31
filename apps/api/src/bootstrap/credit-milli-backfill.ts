/**
 * credit-milli-backfill.ts — preenche os campos canônicos de crédito em milésimos de pãozinho
 * a partir dos campos legados inteiros (× 1000).
 *
 *   User.creditMilli                ← creditBalance   × 1000
 *   CreditTransaction.quantityMilli ← quantity        × 1000
 *   MarketOrder.creditsAppliedMilli ← creditsApplied  × 1000
 *
 * **Por que roda no boot e não só por comando:** a escrita dupla usa `$inc` no campo canônico, e
 * um `$inc` sobre documento em que a chave NÃO existe não credita nada — o movimento é perdido e a
 * chave fica `null`. Aconteceu de verdade em 31/07/2026: o cliente pagou 5,5 🥖, o campo legado
 * baixou 6 (arredondado) e o canônico ficou `null`, então o app mostrava 54 em vez de 54,5 — meio
 * pãozinho cobrado a mais. Rodar no boot, antes de servir tráfego, fecha essa janela.
 *
 * Idempotente: só escreve onde o canônico está ausente/null, então nunca sobrescreve um saldo
 * já fracionado pelo checkout novo.
 *
 * ⚠️ **`{ campo: null }` NÃO acha documento sem a chave no Prisma + MongoDB.** Ele casa apenas
 * `null` explícito; documento em que a chave nunca foi escrita só é encontrado com
 * `{ isSet: false }` (filtro exclusivo do Mongo). Medido nesta base: 9 documentos sem a chave,
 * `{ creditMilli: null }` achava 1 e `{ isSet: false }` achava 9. Por isso todo filtro daqui é
 * `OR: [{ campo: null }, { campo: { isSet: false } }]` — sem os dois, o backfill "roda", não
 * migra ninguém e grava a flag como se tivesse terminado.
 */
import type { PrismaClient } from '@prisma/client'
import type { FastifyBaseLogger } from 'fastify'
import { toMilli } from '@cheirin-de-pao/shared'

const BACKFILL_FLAG = 'creditMilliBackfilledAt'

/** Extrato pode ser grande — processa em lotes para não carregar tudo na memória. */
const BATCH = 500

export interface CreditMilliBackfillResult {
  users: number
  transactions: number
  marketOrders: number
  /** Σ creditMilli e Σ creditBalance × 1000 — devem bater ao fim do backfill. */
  somaMilli: number
  somaLegado: number
}

export async function runCreditMilliBackfill(prisma: PrismaClient): Promise<CreditMilliBackfillResult> {
  let users = 0
  for (;;) {
    const rows = await prisma.user.findMany({
      where: { OR: [{ creditMilli: null }, { creditMilli: { isSet: false } }] },
      select: { id: true, creditBalance: true },
      take: BATCH,
    })
    if (rows.length === 0) break
    for (const u of rows) {
      await prisma.user.update({
        where: { id: u.id },
        data: { creditMilli: toMilli(u.creditBalance ?? 0) },
      })
      users++
    }
    if (rows.length < BATCH) break
  }

  let transactions = 0
  for (;;) {
    const rows = await prisma.creditTransaction.findMany({
      where: { OR: [{ quantityMilli: null }, { quantityMilli: { isSet: false } }] },
      select: { id: true, quantity: true },
      take: BATCH,
    })
    if (rows.length === 0) break
    for (const t of rows) {
      await prisma.creditTransaction.update({
        where: { id: t.id },
        data: { quantityMilli: toMilli(t.quantity ?? 0) },
      })
      transactions++
    }
    if (rows.length < BATCH) break
  }

  let marketOrders = 0
  for (;;) {
    const rows = await prisma.marketOrder.findMany({
      where: { OR: [{ creditsAppliedMilli: null }, { creditsAppliedMilli: { isSet: false } }] },
      select: { id: true, creditsApplied: true },
      take: BATCH,
    })
    if (rows.length === 0) break
    for (const o of rows) {
      await prisma.marketOrder.update({
        where: { id: o.id },
        data: { creditsAppliedMilli: toMilli(o.creditsApplied) },
      })
      marketOrders++
    }
    if (rows.length < BATCH) break
  }

  const [milliAgg, legacyAgg] = await Promise.all([
    prisma.user.aggregate({ _sum: { creditMilli: true } }),
    prisma.user.aggregate({ _sum: { creditBalance: true } }),
  ])

  return {
    users,
    transactions,
    marketOrders,
    somaMilli: milliAgg._sum.creditMilli ?? 0,
    somaLegado: toMilli(legacyAgg._sum.creditBalance ?? 0),
  }
}

/**
 * Roda no boot, antes de servir tráfego, sempre que houver documento pendente. Falha NÃO derruba o
 * boot — loga e não grava a flag, então tenta de novo no próximo restart.
 *
 * A divergência entre Σ canônico e Σ legado é logada como aviso, não como erro: depois do débito
 * fracionado (Onda C) ela passa a ser NORMAL, porque o legado guarda o valor arredondado.
 */
export async function backfillCreditMilliIfNeeded(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
): Promise<void> {
  // O guard é por PENDÊNCIA, não por flag. Uma flag sozinha marcaria como "feito" um backfill que
  // não migrou nada (foi o que aconteceu com o filtro `{ campo: null }`): quem ficou de fora nunca
  // mais seria migrado, o `$inc` da escrita dupla perderia o débito fracionado e as somas em
  // `_sum: { quantityMilli }` ignorariam as linhas antigas. A flag virou só o registro da última
  // execução. O custo é um `count` por boot.
  const pendentes = await prisma.user.count({
    where: { OR: [{ creditMilli: null }, { creditMilli: { isSet: false } }] },
  })
  if (pendentes === 0) return

  try {
    const r = await runCreditMilliBackfill(prisma)
    await prisma.setting.upsert({
      where: { key: BACKFILL_FLAG },
      create: { key: BACKFILL_FLAG, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })
    if (r.somaMilli !== r.somaLegado) {
      log.warn(
        { somaMilli: r.somaMilli, somaLegado: r.somaLegado },
        '[bootstrap] crédito em milésimos: soma canônica diverge do legado (normal após o débito fracionado)',
      )
    }
    log.info(
      { users: r.users, transactions: r.transactions, marketOrders: r.marketOrders },
      '[bootstrap] crédito migrado para milésimos de pãozinho',
    )
  } catch (err) {
    log.error({ err }, '[bootstrap] falha no backfill de crédito em milésimos — boot mantido')
  }
}
