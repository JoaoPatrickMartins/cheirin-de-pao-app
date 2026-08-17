import type { PrismaClient } from '@prisma/client'

/** Config do gancho de porta (Setting key/value → números com defaults defensivos). */
export interface GanchoConfig {
  /** Mínimo de pães num pedido único para ganhar o gancho grátis. */
  pedidoUnicoMin: number
  /** Preço de um gancho adicional (reposição por defeito/perda), em reais. */
  preco: number
  /**
   * Pedidos ENTREGUES (pedido único + Cestinha) para ganhar o gancho grátis por fidelidade.
   * `0` = regra desligada — é o default: a regra só passa a valer quando o admin define o número.
   */
  recorrenciaMin: number
  /**
   * Marco de vigência da regra de fidelidade: só pedidos entregues a partir desta data contam.
   * Gravado na PRIMEIRA ativação da regra e nunca reescrito (desligar/religar preserva o
   * progresso dos clientes). `null` = a regra nunca foi ligada.
   */
  recorrenciaDesde: Date | null
}

const DEFAULT_PEDIDO_UNICO_MIN = 10
const DEFAULT_PRECO = 5

/**
 * Lê a config do gancho a partir do Setting (ganchoPedidoUnicoMin / ganchoPreco /
 * ganchoRecorrenciaMin / ganchoRecorrenciaDesde).
 * Parse defensivo — chave ausente/inválida cai no default (nunca lança).
 * Fonte única compartilhada por admin-settings, client-hook e payments.
 */
export async function getGanchoConfig(
  prisma: Pick<PrismaClient, 'setting'>,
): Promise<GanchoConfig> {
  const [minRow, precoRow, recorrenciaRow, desdeRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ganchoPedidoUnicoMin' } }),
    prisma.setting.findUnique({ where: { key: 'ganchoPreco' } }),
    prisma.setting.findUnique({ where: { key: 'ganchoRecorrenciaMin' } }),
    prisma.setting.findUnique({ where: { key: 'ganchoRecorrenciaDesde' } }),
  ])

  const minParsed = minRow ? parseInt(minRow.value, 10) : NaN
  const pedidoUnicoMin = Number.isFinite(minParsed) && minParsed >= 1 ? minParsed : DEFAULT_PEDIDO_UNICO_MIN

  const precoParsed = precoRow ? parseFloat(precoRow.value) : NaN
  const preco = Number.isFinite(precoParsed) && precoParsed >= 0 ? precoParsed : DEFAULT_PRECO

  // Sem default de negócio: valor ausente/inválido = regra desligada (nunca concede por engano).
  const recorrenciaParsed = recorrenciaRow ? parseInt(recorrenciaRow.value, 10) : NaN
  const recorrenciaMin = Number.isFinite(recorrenciaParsed) && recorrenciaParsed >= 1 ? recorrenciaParsed : 0

  // Data inválida = sem marco → a regra de fidelidade não roda (ver isFreeEligible).
  const desdeParsed = desdeRow ? new Date(desdeRow.value) : null
  const recorrenciaDesde =
    desdeParsed && !Number.isNaN(desdeParsed.getTime()) ? desdeParsed : null

  return { pedidoUnicoMin, preco, recorrenciaMin, recorrenciaDesde }
}
