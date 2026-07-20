// backfill-hook-requests.ts — migra o gancho de porta dos campos legados do User
// (hookRequestedAt / hookDeliveredAt / hookDeliveredById) para a coleção HookRequest.
//
// Idempotente. Roda com: npm run migrate:hooks
//
// Em produção o backfill roda AUTOMATICAMENTE no boot (bootstrap/hooks-backfill.ts, com
// guard de execução única). Este script existe para rodar/reprocessar manualmente — ele
// NÃO respeita a flag `hooksBackfilledAt`; sempre varre (idempotente: pula quem já tem gancho).

import { PrismaClient } from '@prisma/client'
import { runHooksBackfill } from '../bootstrap/hooks-backfill.js'

const prisma = new PrismaClient()

async function main() {
  const { created, skipped } = await runHooksBackfill(prisma)
  console.log('Backfill de ganchos concluído:')
  console.log(`  ${created} HookRequest(s) criado(s), ${skipped} usuário(s) já migrado(s).`)
}

main()
  .catch((err) => {
    console.error('Falha no backfill de ganchos:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
