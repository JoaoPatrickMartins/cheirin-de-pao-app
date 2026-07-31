import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { formatCredits, toMilli } from '@cheirin-de-pao/shared'
import { brtDateStr } from '../../lib/cutoff.js'
import { clientLabel } from '../../lib/client-label.js'
import { stockAlertLabel, type StockAlert } from '../../lib/market-stock-alerts.js'
import { NotificationsService } from '../notifications/notifications.service.js'

/**
 * market-notify.ts — TODAS as notificações da Cestinha ("Além do Pãozin"), cliente e admin.
 *
 * Onda F. Antes existia só o aviso de entrega (`notifyMarketDelivered`): tudo o que dava errado
 * com uma Cestinha acontecia em silêncio — inclusive o cancelamento automático por pagamento não
 * concluído, que devolve crédito e libera estoque sem que o cliente saiba que o pedido caiu.
 *
 * Regras desta camada:
 * - **Best-effort, sempre.** Nenhuma notificação pode interromper um cancelamento, uma transição
 *   de status ou um checkout — o efeito de negócio já aconteceu; falhar aqui só perderia o aviso.
 * - **Quem decide "se avisa" é o chamador**, e só quando a operação realmente mudou algo (o
 *   `count` de um `updateMany` guardado por status). Deduzir "mudou" relendo o estado avisaria
 *   duas vezes quando dois caminhos (sweep + webhook, cliente + admin) tocam o mesmo pedido.
 * - **Texto sem jargão de status.** O cliente lê "pagamento não concluído", nunca
 *   "PENDING_PAYMENT"; e sempre sabe onde foram os pãezins.
 */

/** O mínimo que um aviso precisa saber do pedido. */
interface MarketOrderRef {
  userId: string
  scheduledDate: Date
}

/** YYYY-MM-DD → DD/MM. Ano em aviso de entrega de pão é ruído. */
function dayLabel(date: Date): string {
  const [, m, d] = brtDateStr(date).split('-')
  return `${d}/${m}`
}

// Rótulo da MOEDA do app ("pãozin/pãezins"), não do pão que chega na porta. O valor é fracionado,
// então pode vir decimal (1,5): `formatCredits` entrega no padrão pt-BR e some com o ",0" de valor
// inteiro — nunca montar o texto com `${n}` cru, que imprimiria "1.5".
const paesLabel = (n: number) => (n === 1 ? '1 pãozin' : `${formatCredits(toMilli(n))} pãezins`)
const itemsLabel = (n: number) => (n === 1 ? '1 item' : `${n} itens`)

/**
 * Notifica o cliente que a Cestinha ("Além do Pãozin") foi entregue (MKT-35 — só DELIVERED no
 * v1, paridade com o pão). Reusa o tipo `DELIVERY_DONE` com texto/rota próprios do market.
 * Best-effort: nunca interrompe a transição de status.
 */
export async function notifyMarketDelivered(fastify: FastifyInstance, userId: string): Promise<void> {
  try {
    await new NotificationsService(fastify).notifyUser(userId, {
      type: NotificationType.DELIVERY_DONE,
      title: 'Sua Cestinha chegou! 🧺',
      body: 'Os itens do Além do Pãozin foram entregues junto com o seu pão. Bom apetite!',
      actionRoute: '/client/pedidos',
    })
  } catch (err) {
    fastify.log.warn({ err, userId }, '[market] falha ao notificar entrega da Cestinha — ignorado')
  }
}

/** Por que a Cestinha do cliente foi cancelada sem ele pedir. */
export type MarketCancelCause =
  /** Pagamento não concluído no prazo (Pix expirado/abandonado ou cartão recusado) — sweep. */
  | 'PAYMENT'
  /** Decisão da operação (cancelamento administrativo ou resolução de pedido parado). */
  | 'ADMIN'

/**
 * **F1 — o furo de confiança da Onda F.** Avisa o cliente que a Cestinha foi cancelada sem que
 * ele tenha pedido: o sweep do cron derruba pedidos presos aguardando pagamento e o admin pode
 * cancelar depois do corte. Nos dois casos o crédito volta e o estoque é liberado — e até aqui o
 * cliente só descobria abrindo o app e achando o pedido sumido.
 *
 * Chamar **somente** quando o cancelamento foi efetivado por esta execução (ver cabeçalho).
 */
export async function notifyMarketCancelled(
  fastify: FastifyInstance,
  order: MarketOrderRef,
  opts: { cause: MarketCancelCause; refundedCredits: number; reason?: string },
): Promise<void> {
  const dia = dayLabel(order.scheduledDate)
  const volta =
    opts.refundedCredits > 0
      ? ` ${paesLabel(opts.refundedCredits)} voltaram para o seu saldo.`
      : opts.cause === 'PAYMENT'
        ? ' Nada foi cobrado.'
        : ''

  const body =
    opts.cause === 'PAYMENT'
      ? `O pagamento da sua Cestinha de ${dia} não foi concluído no prazo, então o pedido foi cancelado.${volta} Você pode montar outra quando quiser.`
      : `Sua Cestinha de ${dia} foi cancelada${opts.reason ? ` — ${opts.reason}` : ''}.${volta}`

  try {
    await new NotificationsService(fastify).notifyUser(order.userId, {
      type: NotificationType.MARKET_ORDER_CANCELLED,
      title: opts.cause === 'PAYMENT' ? 'Cestinha cancelada 🧺' : 'Sua Cestinha foi cancelada 🧺',
      body,
      actionRoute: '/client/pedidos',
    })
  } catch (err) {
    fastify.log.warn({ err, userId: order.userId }, '[market] falha ao notificar cancelamento da Cestinha — ignorado')
  }
}

/**
 * **F3** — avisa o cliente que a Cestinha não foi entregue. O pão não tem aviso equivalente
 * (`NOT_DELIVERED` de `Order` só notifica o admin), mas aqui o cliente pagou por produtos que
 * ficaram com a operação: sem aviso, ele fica esperando uma entrega que não vem.
 *
 * O crédito NÃO volta automaticamente — a devolução é decisão do admin no "resolver" de Entregas
 * (Onda B5) —, então o texto não promete estorno.
 */
export async function notifyMarketNotDelivered(
  fastify: FastifyInstance,
  order: MarketOrderRef,
  opts: { reason?: string; refundedCredits?: number } = {},
): Promise<void> {
  const volta =
    opts.refundedCredits && opts.refundedCredits > 0
      ? ` ${paesLabel(opts.refundedCredits)} voltaram para o seu saldo.`
      : ' Fale com a gente para resolver.'

  try {
    await new NotificationsService(fastify).notifyUser(order.userId, {
      type: NotificationType.MARKET_NOT_DELIVERED,
      title: 'Não conseguimos entregar sua Cestinha 🧺',
      body: `A Cestinha de ${dayLabel(order.scheduledDate)} não pôde ser entregue${opts.reason ? ` — ${opts.reason}` : ''}.${volta}`,
      actionRoute: '/client/pedidos',
    })
  } catch (err) {
    fastify.log.warn({ err, userId: order.userId }, '[market] falha ao notificar Cestinha não entregue — ignorado')
  }
}

/**
 * **G2** — avisa o cliente que a Cestinha não entregue foi resolvida COM devolução de pãezinhos.
 *
 * O aviso de F3 ("não conseguimos entregar") sai na hora da falha, quando ainda não se sabe se
 * haverá estorno — decidir isso depende de apurar o que aconteceu com a mercadoria. Este é o
 * segundo capítulo: o dinheiro voltou. Só é enviado quando há estorno de fato; sem isso, seria um
 * push repetindo a má notícia.
 */
export async function notifyMarketLossResolved(
  fastify: FastifyInstance,
  order: MarketOrderRef,
  opts: { refundedCredits: number; reason?: string },
): Promise<void> {
  if (opts.refundedCredits <= 0) return
  try {
    await new NotificationsService(fastify).notifyUser(order.userId, {
      type: NotificationType.MARKET_NOT_DELIVERED,
      title: 'Seus pãezins voltaram 🥖',
      body: `Resolvemos a Cestinha de ${dayLabel(order.scheduledDate)} que não pôde ser entregue: ${paesLabel(opts.refundedCredits)} voltaram para o seu saldo.`,
      actionRoute: '/client/pedidos',
    })
  } catch (err) {
    fastify.log.warn({ err, userId: order.userId }, '[market] falha ao notificar estorno de Cestinha não entregue — ignorado')
  }
}

/** Cestinha na visão de um aviso ao admin: quem, quando, quanto de pão e quantos itens. */
interface AdminMarketOrderRef extends MarketOrderRef {
  breadQty: number
  items: { qty: number }[]
}

/** "Fulano · Apto 12B" — busca best-effort (aviso segue mesmo se o cliente não resolver). */
async function labelFor(fastify: FastifyInstance, userId: string): Promise<string> {
  const client = await fastify.prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, apartment: true, block: true },
  })
  return clientLabel(client ?? {})
}

/**
 * D-1 no texto: pão e item são grandezas diferentes e **nunca** somadas. "4 pães · 2 itens", nunca
 * "6 itens" — o admin usa esse número para saber quanto pão vai à fornada.
 */
function loadLabel(order: AdminMarketOrderRef): string {
  const itens = order.items.reduce((acc, i) => acc + i.qty, 0)
  return [itens > 0 ? `🧺 ${itemsLabel(itens)}` : null, order.breadQty > 0 ? `${order.breadQty} 🥖` : null]
    .filter(Boolean)
    .join(' · ')
}

/**
 * **F4** — avisa os admins de uma Cestinha nova, em paridade com `ADMIN_ORDER_PLACED` do pão.
 *
 * Dispara na **confirmação**, não no checkout: uma Cestinha com parte em dinheiro nasce aguardando
 * pagamento e pode morrer no sweep sem nunca entrar na operação (é o mesmo motivo pelo qual
 * `CONFIRMED_MARKET_STATUSES` exclui `PENDING_PAYMENT`). Avisar antes disso encheria o admin de
 * pedidos que não existem.
 */
export async function notifyAdminMarketOrderPlaced(
  fastify: FastifyInstance,
  order: AdminMarketOrderRef,
): Promise<void> {
  try {
    await new NotificationsService(fastify).notifyAdmins({
      type: NotificationType.ADMIN_ORDER_PLACED,
      title: 'Nova Cestinha',
      body: `${await labelFor(fastify, order.userId)} · ${loadLabel(order)} · ${dayLabel(order.scheduledDate)}`,
      actionRoute: '/admin',
    })
  } catch (err) {
    fastify.log.warn({ err }, '[market] falha ao notificar admin (nova Cestinha) — ignorado')
  }
}

/**
 * **F4** — avisa os admins que o CLIENTE cancelou uma Cestinha já confirmada (paridade com
 * `ADMIN_ORDER_CANCELLED` do pão). A operação precisa saber: o pão dela sai da fornada e os itens
 * voltam para a prateleira.
 */
export async function notifyAdminMarketOrderCancelled(
  fastify: FastifyInstance,
  order: AdminMarketOrderRef,
  opts: { refundedCredits?: number } = {},
): Promise<void> {
  const estorno = opts.refundedCredits && opts.refundedCredits > 0 ? ` · ${paesLabel(opts.refundedCredits)} devolvidos` : ''
  try {
    await new NotificationsService(fastify).notifyAdmins({
      type: NotificationType.ADMIN_ORDER_CANCELLED,
      title: 'Cestinha cancelada',
      body: `${await labelFor(fastify, order.userId)} · ${loadLabel(order)} · ${dayLabel(order.scheduledDate)}${estorno}`,
      actionRoute: '/admin',
    })
  } catch (err) {
    fastify.log.warn({ err }, '[market] falha ao notificar admin (Cestinha cancelada) — ignorado')
  }
}

/**
 * **F5** — avisa os admins que produtos do mercadinho cruzaram o limiar de estoque.
 *
 * Um aviso só, com todos os produtos da mesma reserva: uma Cestinha que zera três produtos é um
 * evento, não três. O que decide *quando* avisar é `buildStockAlerts` (cruzamento de limiar) —
 * aqui é só o texto e o envio.
 */
export async function notifyAdminLowStock(fastify: FastifyInstance, alerts: StockAlert[]): Promise<void> {
  if (alerts.length === 0) return
  const esgotados = alerts.filter((a) => a.kind === 'OUT').length
  try {
    await new NotificationsService(fastify).notifyAdmins({
      type: NotificationType.ADMIN_LOW_STOCK,
      title: esgotados > 0 ? 'Produto esgotado no mercadinho' : 'Estoque baixo no mercadinho',
      body: alerts.map(stockAlertLabel).join(' · '),
      actionRoute: '/admin',
    })
  } catch (err) {
    fastify.log.warn({ err }, '[market] falha ao notificar admin (estoque) — ignorado')
  }
}
