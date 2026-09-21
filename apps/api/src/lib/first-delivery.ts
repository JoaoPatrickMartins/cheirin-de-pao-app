/**
 * first-delivery.ts — fonte ÚNICA do "este é o primeiro pedido do cliente".
 *
 * A operação trata cliente novo diferente: bilhete de boas-vindas no saquinho, gancho de porta,
 * conferir o endereço com mais calma. Sem um selo, isso dependia de alguém lembrar quem era novo
 * — e o cupom, que é o que vai junto com o pão, não dizia nada.
 *
 * A unidade NÃO é o pedido, é o DIA da primeira entrega. Duas razões:
 *
 *   1. Um cliente pode estrear com pedido de pão E Cestinha no mesmo turno (D-4). São dois
 *      registros e uma visita só — marcar apenas um deixaria metade dos cupons daquela porta sem
 *      o aviso, justamente na entrega que importa.
 *   2. Pedido cancelado não é estreia. Se o primeiro morre antes de sair, o selo precisa migrar
 *      para o próximo — senão o cliente é entregue pela primeira vez sem ninguém perceber.
 *
 * Por isso o cálculo é "menor `scheduledDate` entre pedidos válidos", normalizado para dia BRT:
 * quem cair nesse dia é estreia. É retroativo por construção — em tela de histórico o cliente
 * antigo aparece com selo na primeira entrega DELE, que é o que a auditoria quer ver.
 *
 * Custo: duas agregações por requisição, sobre os `userId` da página que já está sendo montada.
 * As telas que usam isto (Separação, ledger de Entregas, pedidos do cliente) já resolvem usuário,
 * condomínio e entregador em lote — esta entra no mesmo `Promise.all`.
 */
import type { PrismaClient } from '@prisma/client'
import { brtDateStr } from './cutoff.js'
import { CONFIRMED_MARKET_STATUSES } from './bread-demand.js'

/**
 * Dia (BRT, "YYYY-MM-DD") da primeira entrega válida de cada cliente informado.
 *
 * Cliente sem nenhum pedido válido simplesmente não entra no mapa — quem consulta trata a
 * ausência como "não é estreia", que é a resposta certa: não há entrega para marcar.
 *
 * A Cestinha entra pelo mesmo conjunto de status do pedido ao fornecedor e do board da Separação
 * (`CONFIRMED_MARKET_STATUSES`), que deixa `PENDING_PAYMENT` de fora: um checkout abandonado é
 * varrido pelo cron, e deixá-lo contar faria um carrinho morto queimar a estreia do cliente.
 */
export async function firstDeliveryDayByUser(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return new Map()

  const [bread, market] = await Promise.all([
    prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, status: { not: 'CANCELLED' } },
      _min: { scheduledDate: true },
    }),
    prisma.marketOrder.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
      _min: { scheduledDate: true },
    }),
  ])

  // Menor data entre as duas coleções. Comparar `Date` aqui e só converter para dia BRT no fim
  // evita comparar strings de dias diferentes com horas diferentes.
  const earliest = new Map<string, Date>()
  for (const row of [...bread, ...market]) {
    const date = row._min?.scheduledDate
    if (!date) continue
    const current = earliest.get(row.userId)
    if (!current || date < current) earliest.set(row.userId, date)
  }

  return new Map([...earliest].map(([userId, date]) => [userId, brtDateStr(date)]))
}

/**
 * A entrega de `scheduledDate` é a estreia do cliente?
 *
 * Compara por DIA BRT, nunca por timestamp: só a Cestinha documenta "meio-dia BRT" como convenção
 * de `scheduledDate`; o pedido de pão nasce em caminhos diferentes (corte da agenda, avulso) e não
 * garante a mesma hora. Igualdade de `Date` daria falso negativo silencioso.
 */
export function isFirstDelivery(firstDay: string | undefined, scheduledDate: Date): boolean {
  if (!firstDay) return false
  return brtDateStr(scheduledDate) === firstDay
}
