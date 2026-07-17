import type { PrismaClient } from '@prisma/client'
import type { FastifyBaseLogger } from 'fastify'

/** Chave do Setting que marca que o backfill de ganchos já rodou (guard de execução única). */
const BACKFILL_FLAG = 'hooksBackfilledAt'

/**
 * runHooksBackfill — migra o gancho de porta dos campos legados do User
 * (hookRequestedAt / hookDeliveredAt / hookDeliveredById) para a coleção HookRequest.
 *
 * Idempotente:
 *   - hookDeliveredAt preenchido       → HookRequest FREE/DELIVERED (grátis já realizado)
 *   - só hookRequestedAt (sem entrega) → HookRequest FREE/REQUESTED (segue na fila)
 *   - usuário já com QUALQUER gancho   → pulado (não duplica)
 *
 * Não usa flag — sempre varre. Chamado pelo script manual (npm run migrate:hooks) e,
 * com guard, por backfillHooksIfNeeded no boot.
 */
export async function runHooksBackfill(prisma: PrismaClient): Promise<{ created: number; skipped: number }> {
  const users = await prisma.user.findMany({
    where: { hookRequestedAt: { not: null } },
    select: { id: true, hookRequestedAt: true, hookDeliveredAt: true, hookDeliveredById: true },
  })

  let created = 0
  let skipped = 0

  for (const u of users) {
    const existing = await prisma.hookRequest.findFirst({ where: { userId: u.id } })
    if (existing) {
      skipped++
      continue
    }

    const delivered = u.hookDeliveredAt != null
    await prisma.hookRequest.create({
      data: {
        userId: u.id,
        type: 'FREE',
        status: delivered ? 'DELIVERED' : 'REQUESTED',
        requestedAt: u.hookRequestedAt,
        ...(delivered ? { deliveredAt: u.hookDeliveredAt } : {}),
        ...(delivered && u.hookDeliveredById ? { deliveredById: u.hookDeliveredById } : {}),
      },
    })
    created++
  }

  return { created, skipped }
}

/**
 * backfillHooksIfNeeded — guard de execução única no boot.
 *
 * Se a flag `hooksBackfilledAt` já existe, sai na hora (custo: 1 leitura de Setting).
 * Caso contrário, roda o backfill e grava a flag. Falha NÃO derruba o boot — apenas loga;
 * como não grava a flag, tentará de novo no próximo restart (o backfill é idempotente).
 */
export async function backfillHooksIfNeeded(prisma: PrismaClient, log: FastifyBaseLogger): Promise<void> {
  const flag = await prisma.setting.findUnique({ where: { key: BACKFILL_FLAG } })
  if (flag) return

  try {
    const { created, skipped } = await runHooksBackfill(prisma)
    await prisma.setting.upsert({
      where: { key: BACKFILL_FLAG },
      create: { key: BACKFILL_FLAG, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })
    log.info(`[bootstrap] backfill de ganchos: ${created} criado(s), ${skipped} já migrado(s)`)
  } catch (err) {
    log.warn({ err }, '[bootstrap] backfill de ganchos falhou — tentará novamente no próximo boot')
  }
}
