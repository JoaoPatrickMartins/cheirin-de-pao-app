import type { PrismaClient } from '@prisma/client'

/** Config do gancho de porta (Setting key/value → números com defaults defensivos). */
export interface GanchoConfig {
  /** Mínimo de pães num pedido único para ganhar o gancho grátis. */
  pedidoUnicoMin: number
  /** Preço de um gancho adicional (reposição por defeito/perda), em reais. */
  preco: number
}

const DEFAULT_PEDIDO_UNICO_MIN = 10
const DEFAULT_PRECO = 5

/**
 * Lê a config do gancho a partir do Setting (ganchoPedidoUnicoMin / ganchoPreco).
 * Parse defensivo — chave ausente/inválida cai no default (nunca lança).
 * Fonte única compartilhada por admin-settings, client-hook e payments.
 */
export async function getGanchoConfig(
  prisma: Pick<PrismaClient, 'setting'>,
): Promise<GanchoConfig> {
  const [minRow, precoRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ganchoPedidoUnicoMin' } }),
    prisma.setting.findUnique({ where: { key: 'ganchoPreco' } }),
  ])

  const minParsed = minRow ? parseInt(minRow.value, 10) : NaN
  const pedidoUnicoMin = Number.isFinite(minParsed) && minParsed >= 1 ? minParsed : DEFAULT_PEDIDO_UNICO_MIN

  const precoParsed = precoRow ? parseFloat(precoRow.value) : NaN
  const preco = Number.isFinite(precoParsed) && precoParsed >= 0 ? precoParsed : DEFAULT_PRECO

  return { pedidoUnicoMin, preco }
}
