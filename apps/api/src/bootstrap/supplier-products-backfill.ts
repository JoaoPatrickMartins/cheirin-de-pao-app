// supplier-products-backfill.ts — semeia a matriz de fornecimento (`SupplierProduct`) a partir
// do modelo legado de UM produto (D-10).
//
// Antes da matriz, o fornecimento vivia em dois lugares:
//   - `Supplier.pricePerUnit`   → o preço DO PÃO daquele fornecedor;
//   - `Setting.supplierSplitPrincipalPct` → um percentual GLOBAL (default 75) do "principal".
//
// Sem este backfill, no primeiro boot depois do deploy o pão ficaria SEM FORNECEDOR NENHUM na
// matriz e a geração do pedido ao fornecedor falharia — o pão de amanhã não seria comprado. Por
// isso ele roda no boot, com guard de execução única, antes de qualquer geração.
//
// Idempotente por (supplierId, productId): fornecedor que já tem linha do pão é pulado.

import type { PrismaClient } from '@prisma/client'
import type { FastifyBaseLogger } from 'fastify'

const BACKFILL_FLAG = 'supplierProductsBackfilledAt'
const BREAD_PRODUCT_KEY = 'breadProductId'
const SUPPLIER_SPLIT_KEY = 'supplierSplitPrincipalPct'
const DEFAULT_SPLIT_PCT = 75

export interface BackfillResult {
  created: number
  skipped: number
  /** Motivo de não ter feito nada (sem produto-pão configurado / sem fornecedor ativo). */
  reason?: string
}

/**
 * runSupplierProductsBackfill — cria uma linha `SupplierProduct` do PÃO para cada fornecedor ativo.
 *
 * Fatia padrão (`defaultSharePct`) reproduz o split global histórico, para o comportamento do
 * pedido ao fornecedor não mudar no dia do deploy:
 *   - 1 fornecedor ativo               → 100 nele.
 *   - principal + 1 reserva            → `supplierSplitPrincipalPct` / o resto (75/25 por default).
 *   - principal + N reservas (N > 1)   → principal fica com o pct e as reservas dividem o resto,
 *                                        com a sobra do arredondamento na primeira.
 * `isPreferred` recebe o `isPrincipal` legado (desempata o arredondamento no motor de rateio).
 */
export async function runSupplierProductsBackfill(prisma: PrismaClient): Promise<BackfillResult> {
  const breadRow = await prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } })
  const breadProductId = breadRow?.value
  if (!breadProductId) {
    return { created: 0, skipped: 0, reason: 'Setting breadProductId ausente (defaults-seed ainda não rodou?)' }
  }
  const breadProduct = await prisma.product.findUnique({ where: { id: breadProductId } })
  if (!breadProduct) {
    return { created: 0, skipped: 0, reason: `Produto-pão ${breadProductId} não encontrado` }
  }

  const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  if (suppliers.length === 0) {
    return { created: 0, skipped: 0, reason: 'Nenhum fornecedor ativo cadastrado' }
  }

  const splitRow = await prisma.setting.findUnique({ where: { key: SUPPLIER_SPLIT_KEY } })
  const parsed = splitRow ? Number(splitRow.value) : NaN
  const principalPct =
    Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed) : DEFAULT_SPLIT_PCT

  // Mesma escolha de "principal" que o `createQuick` legado fazia: o marcado, senão o primeiro.
  const principal = suppliers.find((s) => s.isPrincipal) ?? suppliers[0]
  const reserves = suppliers.filter((s) => s.id !== principal.id)

  const shareOf = (supplierId: string): number => {
    if (reserves.length === 0) return 100
    if (supplierId === principal.id) return principalPct
    const rest = 100 - principalPct
    const base = Math.floor(rest / reserves.length)
    // A sobra do arredondamento vai para a primeira reserva → a soma fecha exatamente 100.
    const idx = reserves.findIndex((r) => r.id === supplierId)
    return idx === 0 ? base + (rest - base * reserves.length) : base
  }

  let created = 0
  let skipped = 0

  for (const s of suppliers) {
    const existing = await prisma.supplierProduct.findUnique({
      where: { supplierId_productId: { supplierId: s.id, productId: breadProductId } },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.supplierProduct.create({
      data: {
        supplierId: s.id,
        productId: breadProductId,
        unitCost: s.pricePerUnit,
        defaultSharePct: shareOf(s.id),
        isPreferred: s.id === principal.id,
        isActive: true,
      },
    })
    created++
  }

  return { created, skipped }
}

/**
 * backfillSupplierProductsIfNeeded — guard de execução única no boot.
 *
 * Se a flag já existe, sai na hora (1 leitura de Setting). Falha NÃO derruba o boot: apenas loga e
 * não grava a flag, então tenta de novo no próximo restart (o backfill é idempotente).
 *
 * A flag também NÃO é gravada quando o backfill não tinha o que fazer por falta de pré-requisito
 * (sem produto-pão ou sem fornecedor ativo) — assim ele roda de verdade quando o admin cadastrar
 * o primeiro fornecedor, em vez de ficar marcado como "já feito" para sempre.
 */
export async function backfillSupplierProductsIfNeeded(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
): Promise<void> {
  const flag = await prisma.setting.findUnique({ where: { key: BACKFILL_FLAG } })
  if (flag) return

  try {
    const { created, skipped, reason } = await runSupplierProductsBackfill(prisma)
    if (reason) {
      log.warn({ reason }, '[bootstrap] backfill da matriz de fornecimento adiado — tenta de novo no próximo boot')
      return
    }
    await prisma.setting.upsert({
      where: { key: BACKFILL_FLAG },
      create: { key: BACKFILL_FLAG, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })
    log.info({ created, skipped }, '[bootstrap] matriz de fornecimento semeada (pão × fornecedores)')
  } catch (err) {
    log.error({ err }, '[bootstrap] falha no backfill da matriz de fornecimento — boot mantido')
  }
}
