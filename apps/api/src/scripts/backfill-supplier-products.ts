// backfill-supplier-products.ts — semeia a matriz de fornecimento (`SupplierProduct`) a partir do
// modelo legado de um produto só (`Supplier.pricePerUnit` + `supplierSplitPrincipalPct`).
//
// Idempotente. Roda com: npm run migrate:supplier-products
//
// Em produção roda AUTOMATICAMENTE no boot (bootstrap/supplier-products-backfill.ts, com guard de
// execução única). Este script existe para rodar/reprocessar manualmente — ele NÃO respeita a flag
// `supplierProductsBackfilledAt`; sempre varre (idempotente: pula fornecedor que já tem a linha).

import { PrismaClient } from '@prisma/client'
import { runSupplierProductsBackfill } from '../bootstrap/supplier-products-backfill.js'

const prisma = new PrismaClient()

async function main() {
  const { created, skipped, reason } = await runSupplierProductsBackfill(prisma)
  if (reason) {
    console.log(`Backfill da matriz de fornecimento NÃO executado: ${reason}`)
    return
  }
  console.log('Backfill da matriz de fornecimento concluído:')
  console.log(`  ${created} linha(s) criada(s), ${skipped} fornecedor(es) já com o pão cadastrado.`)
}

main()
  .catch((err) => {
    console.error('Falha no backfill da matriz de fornecimento:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
