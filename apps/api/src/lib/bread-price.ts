import type { PrismaClient } from '@prisma/client'
import { fromMilli } from '@cheirin-de-pao/shared'
import { excludeNonCreditPurpose } from './revenue.js'

/**
 * Quanto vale, em R$, um pãozin dado de bônus — o "≈ R$" da config do Indique e Ganhe (A3) e o
 * custo estimado do relatório (A6).
 *
 * A conta é o preço médio PAGO por pãozin: R$ pagos em compra de pão ÷ pães comprados. É a mesma
 * base do passivo de crédito (`getCreditLiability`), que o DRE usa para a receita por competência
 * — três telas falando de "quanto vale um pãozin" não podem dar três números.
 *
 * Sem nenhuma venda ainda (app recém-lançado), cai no preço do pão avulso; sem ele, 0 (a tela
 * então não mostra o "≈ R$").
 */
export async function estimateBreadUnitPrice(
  prisma: Pick<PrismaClient, 'payment' | 'creditTransaction' | 'setting'>,
): Promise<number> {
  const [paid, purchased] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', ...excludeNonCreditPurpose } }),
    prisma.creditTransaction.aggregate({ _sum: { quantityMilli: true }, where: { type: 'PURCHASE' } }),
  ])
  const breads = fromMilli(purchased._sum.quantityMilli ?? 0)
  const total = paid._sum.amount ?? 0
  if (breads > 0 && total > 0) return total / breads

  const avulso = await prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
  const unit = avulso ? Number(avulso.value) : NaN
  return Number.isFinite(unit) && unit > 0 ? unit : 0
}
