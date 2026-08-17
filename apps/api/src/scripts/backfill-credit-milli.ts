// backfill-credit-milli.ts — entrada por comando do backfill de crédito em milésimos.
//
// Roda com: npm run -w @cheirin-de-pao/api migrate:credit-milli
//
// A lógica vive em `bootstrap/credit-milli-backfill.ts` porque o backfill TAMBÉM roda no boot,
// antes de servir tráfego (a escrita dupla usa `$inc`, e `$inc` num campo ausente criaria um
// saldo canônico errado). Este script existe para reprocessar/conferir manualmente, e não é
// pré-requisito de deploy.
//
// Idempotente: rodar de novo deve reportar 0 preenchidos.

import { PrismaClient } from '@prisma/client'
import { runCreditMilliBackfill } from '../bootstrap/credit-milli-backfill.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Backfill de crédito em milésimos (1 pãozinho = 1000)...')
  const r = await runCreditMilliBackfill(prisma)

  console.log(`  User.creditMilli: ${r.users} preenchidos.`)
  console.log(`  CreditTransaction.quantityMilli: ${r.transactions} preenchidos.`)
  console.log(`  MarketOrder.creditsAppliedMilli: ${r.marketOrders} preenchidos.`)
  console.log(`  Conferência: Σ creditMilli = ${r.somaMilli} · Σ creditBalanceLegacy × 1000 = ${r.somaLegado}`)

  if (r.somaMilli !== r.somaLegado) {
    const difEmPaes = (r.somaMilli - r.somaLegado) / 1000
    console.warn(
      `  ATENÇÃO: divergência de ${difEmPaes} pãezinhos. É ESPERADO depois do débito fracionado ` +
        `(o campo legado guarda o valor arredondado); antes disso, indica documento fora do backfill.`,
    )
  }

  console.log('Backfill concluído.')
}

main()
  .catch((err) => {
    console.error('Falha no backfill de crédito:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
