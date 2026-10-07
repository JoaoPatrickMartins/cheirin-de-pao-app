import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { NotificationType, OrderStatus, MarketOrderStatus, PaymentStatus, TransactionType, Prisma } from '@prisma/client'
import { fromMilli, toMilli, stopShortCode, isProofExpired, CORRECTED_BY_ADMIN_CODE, STOP_ISSUE_LABELS, type StopIssueType } from '@cheirin-de-pao/shared'
import { getRouteConfig } from '../../lib/route-config.js'
import { getSignedReadUrl, isStorageConfigured } from '../../lib/storage.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { dayKeyOf, type DayKey, brtDateStr, brtNoonFromStr, brtDayRange } from '../../lib/cutoff.js'
import { projectScheduleForDate } from '../../lib/schedule-projection.js'
import { excludeNonCreditPurpose } from '../../lib/revenue.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'
import { firstDeliveryDayByUser, isFirstDelivery } from '../../lib/first-delivery.js'
import { reverseMarketOrder } from '../../lib/market-reversal.js'
import { propagateMarketStatusForOrder, dispatchMarketForOrders, assignMarketByCondoDay } from '../../lib/market-pipeline.js'
import { notifyMarketCancelled, notifyMarketDelivered, notifyMarketNotDelivered } from '../market/market-notify.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { ensureSuggestion } from '../courier/courier-plan.js'
import { courierOffMap } from '../../lib/courier-availability.js'
import { clientLabel } from '../../lib/client-label.js'
import { afterDelivery } from '../../lib/referral.js'
import { syncShiftOffers, type ShiftKey } from '../../lib/courier-shift-offers.js'

/** Centavos, sem lixo de ponto flutuante em somas de R$. */
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Código curto do pedido — o mesmo impresso no cupom, por onde o operador chama o pedido e o
 * entregador digita quando a câmera falha (6 caracteres desde o app do entregador, T-1).
 */
const shortOrderCode = (id: string) => stopShortCode(id)

/**
 * Soma movimentos de crédito em MILÉSIMOS e converte no fim, em valor absoluto.
 * Somar decimais acumularia erro de float; o `abs` é porque débito é negativo e a tela mostra
 * "quanto voltou", não o sinal.
 */
const sumMilliAbs = (rows: { quantityMilli: number | null }[]) =>
  Math.abs(fromMilli(rows.reduce((acc, r) => acc + (r.quantityMilli ?? 0), 0)))

/**
 * Mapa de transições de estado válidas para pedidos.
 *
 * T-05-02: Qualquer transição fora deste mapa lança statusCode 422 antes do update.
 * Ciclo de vida v2 (corte → separação → entrega → desfecho):
 *   SCHEDULED        → SEPARATED | OUT_FOR_DELIVERY | DELIVERED | NOT_DELIVERED | CANCELLED
 *   SEPARATED        → OUT_FOR_DELIVERY | DELIVERED | NOT_DELIVERED | SCHEDULED (desfazer) | CANCELLED
 *   OUT_FOR_DELIVERY → DELIVERED | NOT_DELIVERED | CANCELLED
 *
 * Nota: SCHEDULED→OUT_FOR_DELIVERY e OUT_FOR_DELIVERY→DELIVERED são mantidos por
 * compatibilidade. O gate da Entrega passa a exigir SEPARATED (ver admin-separation).
 * SCHEDULED→DELIVERED/NOT_DELIVERED existem para a resolução de "pedidos parados":
 * um pedido esquecido nunca foi separado, e o admin precisa fechar o desfecho a
 * posteriori (ver resolveStuckOrder). Sem isso, o resolver falharia com 422.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['SEPARATED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED', 'CANCELLED'],
  SEPARATED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED', 'SCHEDULED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'NOT_DELIVERED', 'CANCELLED'],
}

/** Status válidos por coleção — o ledger unificado filtra cada lado com o que ele conhece. */
const BREAD_STATUSES = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED', 'CANCELLED'] as const
const MARKET_STATUSES = ['PENDING_PAYMENT', ...BREAD_STATUSES] as const

const DEFAULT_SLOT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }
function fallbackSlotLabel(slotId: string): string {
  if (!slotId) return 'Sem horário'
  return DEFAULT_SLOT_LABELS[slotId] ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
}

/** Detalhamento de um bloco dentro de um condomínio na divisão de entregas. */
export interface DivisionBlock {
  block: string
  /** Pães do bloco — inclui o pão vendido dentro da Cestinha (D-1). */
  quantity: number
  orderIds: string[]
  /** IDs das Cestinhas do bloco — necessários para despachar a parada só-market. */
  marketOrderIds: string[]
  /** Itens do mercadinho do bloco — métrica paralela aos pães (D-1). */
  items: number
}

/**
 * Unidade atribuível a um entregador na divisão de entregas.
 * `block === null` → condomínio inteiro (traz `blocks` para o admin "explodir");
 * `block !== null` → um bloco específico de um condomínio (já atômico).
 */
export interface DivisionUnit {
  condominiumId: string
  condominiumName: string
  block: string | null
  quantity: number
  orderIds: string[]
  marketOrderIds: string[]
  items: number
  blocks: DivisionBlock[]
}

export interface DivisionAssignment {
  courierId: string
  courierName: string
  condominiums: DivisionUnit[]
  /** Pães atribuídos (inclui o pão da Cestinha). */
  total: number
  /** Itens do mercadinho atribuídos — carga real do entregador, ao lado dos pães. */
  totalItems: number
  /**
   * De folga / fora da escala no dia (F-8) ou RECUSOU o turno (plano-termos-legais §5): fica fora da
   * sugestão; o admin ainda pode atribuir.
   */
  offReason?: 'FOLGA' | 'FORA_DA_ESCALA' | 'RECUSOU' | null
}

/** Turno recusado no dia/turno (plano-termos-legais §5) — o aviso no card de divisão. */
export interface DivisionDeclined {
  courierId: string
  courierName: string
  slotId: string
  at: string
  reason: string | null
  stops: number
}

/**
 * Detalhamento por bloco no status de entregas. Contagens são de PARADAS (D-5), não de pães:
 * pão + Cestinha do mesmo cliente contam 1 e só entram em `delivered` quando os dois foram entregues.
 */
export interface DeliveryBlockStatus {
  block: string
  scheduled: number
  delivered: number
  orderIds: string[]
  /** IDs das Cestinhas do bloco — o aprovar/atribuir precisa delas para a parada só-market. */
  marketOrderIds: string[]
}

export interface DeliveryStatusRow {
  condominiumId: string
  condominiumName: string
  scheduled: number
  delivered: number
  orderIds: string[]
  marketOrderIds: string[]
  blocks: DeliveryBlockStatus[]
}

/**
 * Uma PARADA na divisão de entregas (D-5): tudo o que um cliente recebe num turno — pedido(s) de
 * pão e/ou Cestinha(s) — numa unidade só, porque é uma visita só.
 *
 * `marketOrderIds` existe para a parada SÓ-Cestinha poder ser despachada: sem `orderIds` não havia
 * o que atribuir, então ela só pegava carona pelo guard `courierId: null` de
 * `dispatchMarketForOrders` — o primeiro entregador processado levava, sem o admin ver nem poder
 * mudar. E um condomínio/turno só com Cestinha nunca recebia entregador nenhum.
 */
type DivisionStop = {
  userId: string
  condominiumId: string | null
  /** Pães da parada (Order.quantity + MarketOrder.breadQty). */
  quantity: number
  /** Itens do mercadinho da parada. */
  items: number
  orderIds: string[]
  marketOrderIds: string[]
  /** Entregador já gravado (Modo A — divisão aprovada). */
  courierId: string | null
}

/**
 * Linha do ledger de pedidos (verificação geral + histórico + limbo).
 *
 * D-4: o ledger é UNIFICADO — pedidos de pão e Cestinhas na mesma lista, discriminados por `kind`.
 * O propósito declarado da tela é "garantir que nenhum pedido fique invisível"; uma aba separada
 * obrigaria a olhar em dois lugares para saber se algo ficou para trás.
 *
 * Em linhas `CESTINHA`: `orderId` fica vazio e `marketOrderId` preenchido; `quantity` é o
 * `breadQty` (pães da Cestinha — pode ser 0 numa Cestinha só de produtos) e os produtos vivem em
 * `marketItems` (D-1). `type` vale `'MARKET'`.
 */
export interface LedgerRow {
  /** Discriminador (D-4). */
  kind: 'BREAD' | 'CESTINHA'
  orderId: string
  /** Preenchido só em `kind: 'CESTINHA'`. */
  marketOrderId: string
  userId: string
  clientName: string
  condominiumId: string
  condominiumName: string
  block: string
  /** Complemento do bloco ("Lado A"); '' quando não há. */
  complement: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: string
  status: string
  scheduledDate: string
  courierId: string
  courierName: string
  separatedAt: string
  deliveredAt: string
  failedAt: string
  failureReason: string
  cancelReason: string
  deliveryNote: string
  refunded: boolean
  // Vínculo leve ao pagamento que financiou o avulso (vazio quando pago só com saldo).
  paymentId: string
  paymentAmount: number
  paymentStatus: string
  /** Produtos do mercadinho da linha — métrica paralela aos pães (D-1). Vazio em `BREAD`. */
  marketItems: { name: string; qty: number }[]
  marketItemCount: number
  /** Split da Cestinha (0 em `BREAD`): pãezinhos aplicados × R$ cobrado no gateway. */
  creditsApplied: number
  moneyAmount: number
  /** Valor total da Cestinha em R$ (0 em `BREAD`). */
  totalValue: number
  /**
   * Estreia do cliente — a linha cai no dia da primeira entrega dele (`lib/first-delivery.ts`).
   * Retroativo por construção: em histórico, o cliente antigo aparece marcado na primeira
   * entrega DELE, que é o que a auditoria quer ver.
   */
  isFirstOrder: boolean
}

/** Pagamento vinculado a um pedido — o que a conciliação precisa ver. */
export interface OrderPayment {
  id: string
  amount: number
  method: string
  status: string
  /** CREDITS | HOOK | MARKET. Documento antigo sem o campo lê CREDITS. */
  purpose: string
  createdAt: string
  /** Id no gateway (Stripe ou Mercado Pago) — a tela só quer o que colar na conciliação. */
  gatewayId: string
  comboName: string
  quantity: number
}

/**
 * Um pedido com o detalhe completo: a linha do ledger MAIS o que não cabe numa lista.
 * Alimenta o resumo do pedido no admin (Entregas e Clientes).
 */
export interface OrderDetail extends LedgerRow {
  createdAt: string
  /** 6 últimos do id, como no cupom — é por ele que o operador chama o pedido. */
  code: string
  /** Pãezinhos debitados na criação do pedido (split aplicado, na Cestinha). */
  creditsDebited: number
  /**
   * `creditsDebited` veio da regra, não do extrato — pedido do corte da agenda anterior ao
   * vínculo `referenceId`. A tela avisa, para ninguém tratar o número como linha auditada.
   */
  creditsDebitedDerived: boolean
  /** Pãezinhos já devolvidos deste pedido. */
  refundedCredits: number
  payment: OrderPayment | null
  /** Motivo padronizado da não entrega (app do entregador); null em pedido antigo. */
  failureCode: string | null
  /** Comprovante da parada (A1 do plano do entregador); null sem registro. */
  proof: ProofDetail | null
  /** Problemas que o entregador reportou nesta parada (E11), do mais recente. */
  issues: IssueDetail[]
  /** Correção entregue → não entregue feita pelo admin (H-2); null sem correção. */
  correction: { at: string; byName: string | null; note: string | null } | null
}

/** Problema reportado pelo entregador numa entrega realizada (A1 · "reportado"). */
export interface IssueDetail {
  id: string
  type: string
  label: string
  text: string | null
  createdAt: string
  courierName: string | null
  status: string
  resolution: string | null
}

/** Comprovante no detalhe do pedido. A foto é PRIVADA: vai como URL assinada de curta duração. */
export interface ProofDetail {
  /** 'PENDING' (foto ainda subindo) | 'OK' | 'NONE' (exceção, com `note`) | 'SKIPPED' (opcional, pulou). */
  status: string
  outcome: string
  required: boolean
  photoUrl: string | null
  photoAt: string | null
  note: string | null
  confirmedVia: string | null
  /** Mais de 90 dias: a foto não é mais servida (D-4b). */
  expired: boolean
  /** O cliente vê esta foto (toggle global `fotoClienteVisivel`) — rótulo "cliente vê"/"só admin". */
  clientVisible: boolean
  /** Ids da parada (pão + Cestinhas) — para achar os reportes. Não vai para a tela. */
  stopIds?: string[]
}

/** Filtros do ledger de pedidos. */
export interface LedgerFilters {
  from?: string
  to?: string
  status?: string[]
  condominiumId?: string
  courierId?: string
  q?: string
  limit?: number
  skip?: number
  /** Restringe a um tipo (D-4). Ausente = os dois. */
  kind?: 'BREAD' | 'CESTINHA'
}

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

/**
 * AdminOrdersService — lógica de negócio para gestão de pedidos pelo Admin.
 *
 * Responsabilidades:
 * - Validar e executar transições de status (SCHEDULED → OUT_FOR_DELIVERY → DELIVERED)
 * - Disparar push OneSignal ao marcar DELIVERED (best-effort — D-06)
 * - Persistir Notification no banco com trim de 30 por usuário (D-10, T-05-03)
 *
 * Nota: createAndTrim é implementado internamente (sem depender do Plan 02)
 * para garantir independência dos planos Wave 1.
 */
export class AdminOrdersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Atualiza o status de um pedido com validação de transição.
   *
   * Registra o marco de tempo correspondente (separatedAt/deliveredAt/failedAt/cancelledAt)
   * e o motivo (failureReason/cancelReason) quando aplicável — garante rastreabilidade
   * e evita pedidos "no limbo".
   *
   * @param reason motivo obrigatório do ponto de vista de negócio para NOT_DELIVERED/CANCELLED
   * @throws { statusCode: 404, message: 'Pedido não encontrado' } se order não existe
   * @throws { statusCode: 422, message: 'Transição inválida: ...' } se transição não permitida
   */
  async updateOrderStatus(orderId: string, newStatus: string, reason?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })

    if (!order) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const allowed = VALID_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw {
        statusCode: 422,
        message: `Transição inválida: ${order.status} → ${newStatus}`,
      }
    }

    const now = new Date()
    const data: Prisma.OrderUpdateInput = { status: newStatus as OrderStatus }
    switch (newStatus) {
      case 'SEPARATED':
        data.separatedAt = now
        break
      case 'DELIVERED':
        data.deliveredAt = now
        break
      case 'NOT_DELIVERED':
        data.failedAt = now
        data.failureReason = reason ?? null
        break
      case 'CANCELLED':
        data.cancelledAt = now
        data.cancelReason = reason ?? null
        break
      case 'SCHEDULED':
        // desfazer separação — limpa o marco
        data.separatedAt = null
        break
    }

    await this.prisma.order.update({ where: { id: orderId }, data })

    // A Cestinha do mesmo cliente/dia/slot acompanha a transição (parada combinada pão+market).
    // O retorno é quantas Cestinhas ESTA transição moveu — é o que autoriza avisar o cliente.
    const marketMoved = await propagateMarketStatusForOrder(this.prisma, order, newStatus, reason)

    if (newStatus === 'DELIVERED') {
      // UM aviso por parada (V-18 do plano do entregador): com Cestinha junto, o aviso do pão a
      // menciona — antes saíam dois "entregue" para a mesma campainha. O gatilho continua sendo a
      // transição desta chamada (MKT-35): Cestinha já entregue antes pelo fluxo só-market não
      // entra no texto.
      // Entrega feita pelo entregador com a foto visível ao cliente: o aviso leva ao comprovante.
      const proofRoute =
        order.courierId && (await getRouteConfig(this.prisma)).fotoClienteVisivel
          ? `/client/pedidos?comprovante=${order.id}`
          : undefined
      await this.notifyAndPersist(order, { withCestinha: marketMoved > 0, proofRoute })
      // Indique e Ganhe — a 1ª entrega paga pode qualificar a indicação do cliente. Cobre o
      // entregador, a separação e o admin (todos passam por aqui), e a Cestinha propagada acima.
      // Nunca lança.
      await afterDelivery(this.fastify, order.userId)
    }

    // F3 — Cestinha da parada combinada não entregue. O pão não tem aviso equivalente ao cliente,
    // mas aqui ficaram produtos pagos com a operação: sem aviso ele espera uma entrega que não vem.
    if (newStatus === 'NOT_DELIVERED' && marketMoved > 0) {
      await notifyMarketNotDelivered(this.fastify, order, { reason })
    }

    // Avisos ao admin — entrega realizada / não realizada (best-effort).
    if (newStatus === 'DELIVERED' || newStatus === 'NOT_DELIVERED') {
      await this.notifyAdminsDelivery(order, newStatus, reason)
    }
  }

  /**
   * Notifica os admins do desfecho de uma entrega (DELIVERED/NOT_DELIVERED), respeitando
   * os toggles individuais. Best-effort — nunca interrompe a transição de status.
   */
  private async notifyAdminsDelivery(
    order: { id: string; userId: string; quantity: number },
    status: 'DELIVERED' | 'NOT_DELIVERED',
    reason?: string,
  ): Promise<void> {
    try {
      const client = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { name: true, apartment: true, block: true, complement: true },
      })
      const who = clientLabel(client ?? {})
      const paes = order.quantity === 1 ? '1 pão' : `${order.quantity} pães`
      if (status === 'DELIVERED') {
        await new NotificationsService(this.fastify).notifyAdmins({
          type: NotificationType.ADMIN_DELIVERY_DONE,
          title: 'Entrega realizada',
          body: `${who} · ${paes}`,
          actionRoute: '/admin',
        })
      } else {
        await new NotificationsService(this.fastify).notifyAdmins({
          type: NotificationType.ADMIN_DELIVERY_FAILED,
          title: 'Entrega não realizada',
          body: `${who} · ${paes}${reason ? ` · ${reason}` : ''}`,
          actionRoute: '/admin',
        })
      }
    } catch (err) {
      this.fastify.log.warn({ err, orderId: order.id }, '[admin-orders] falha ao notificar admin (entrega) — ignorado')
    }
  }

  /**
   * Avisa um entregador que recebeu novas entregas. Best-effort.
   * @param count quantas entregas foram atribuídas/despachadas nesta operação
   */
  private async notifyCourierNewOrders(courierId: string, count: number): Promise<void> {
    if (count <= 0) return
    try {
      const entregas = count === 1 ? '1 entrega' : `${count} entregas`
      await new NotificationsService(this.fastify).notifyUser(courierId, {
        type: NotificationType.COURIER_NEW_ORDERS,
        title: 'Novas entregas',
        body: `Você tem ${entregas} para fazer hoje. Toque para ver a rota.`,
        actionRoute: '/courier',
      })
    } catch (err) {
      this.fastify.log.warn({ err, courierId }, '[admin-orders] falha ao notificar entregador — ignorado')
    }
  }

  /**
   * Dispara push OneSignal (best-effort) e persiste Notification ao DELIVERED.
   *
   * D-06: Falha do push é silenciosa — não bloqueia o fluxo.
   * Persist é obrigatório e acontece fora do try do push.
   */
  private async notifyAndPersist(
    order: {
      id: string
      userId: string
      quantity: number
    },
    opts: { withCestinha?: boolean; proofRoute?: string } = {},
  ): Promise<void> {
    const paes = order.quantity === 1 ? 'Seu pão foi entregue' : `Seus ${order.quantity} pães foram entregues`
    const body = opts.withCestinha
      ? `${order.quantity === 1 ? 'Seu pão e a Cestinha foram entregues' : `Seus ${order.quantity} pães e a Cestinha foram entregues`}. Bom apetite!`
      : `${paes}. Bom apetite!`
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { oneSignalPlayerId: true },
    })

    // 1. Push best-effort (D-06)
    if (user?.oneSignalPlayerId) {
      try {
        const osClient = createOsClient()
        const notification = new OneSignal.Notification()
        notification.app_id = process.env.ONESIGNAL_APP_ID!
        notification.include_subscription_ids = [user.oneSignalPlayerId]
        notification.headings = { pt: 'Entrega realizada! 🎉' }
        notification.contents = { pt: body }
        notification.data = { screen: 'pedidos' }
        await osClient.createNotification(notification)
      } catch (pushErr) {
        this.fastify.log.warn(
          { orderId: order.id, userId: order.userId, err: pushErr },
          '[admin-orders] falha ao enviar push de entrega — ignorado',
        )
      }
    }

    // 2. Persist Notification obrigatório — fora do try do push
    await this.createAndTrim({
      userId: order.userId,
      type: 'DELIVERY_DONE',
      title: 'Entrega realizada',
      body,
      actionRoute: opts.proofRoute ?? '/client/pedidos',
    })
  }

  /**
   * Atribui um entregador a orders em batch.
   *
   * D-11/D-13: Atribuicao em batch via orderIds ou por condominiumId+date.
   * T-06-04: Role check ADMIN fica no controller.
   *
   * @param courierId ID do entregador a ser atribuido
   * @param opts orderIds (lista explicita) OU condominiumId+date (query em 2 etapas)
   */
  async assignCourier(
    courierId: string,
    opts: {
      orderIds?: string[]
      marketOrderIds?: string[]
      condominiumId?: string
      date?: string
    },
  ): Promise<{ count: number }> {
    const hasIds = (opts.orderIds?.length ?? 0) > 0 || (opts.marketOrderIds?.length ?? 0) > 0
    if (hasIds) {
      let count = 0
      if (opts.orderIds && opts.orderIds.length > 0) {
        // Atribuicao direta por lista de IDs — gate: só pedidos separados ou já em rota
        const result = await this.prisma.order.updateMany({
          where: { id: { in: opts.orderIds }, status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] } },
          data: { courierId },
        })
        count += result.count
        // Cestinha pega carona: mesmo courier nos MarketOrder do escopo dos pedidos atribuídos.
        const scopeOrders = await this.prisma.order.findMany({
          where: { id: { in: opts.orderIds } },
          select: { userId: true, condominiumId: true, slotId: true, scheduledDate: true },
        })
        await dispatchMarketForOrders(this.prisma, scopeOrders, courierId, false)
      }
      // Paradas só-Cestinha atribuídas explicitamente (mesmo motivo do approveDivision).
      if (opts.marketOrderIds && opts.marketOrderIds.length > 0) {
        const r = await this.prisma.marketOrder.updateMany({
          where: {
            id: { in: opts.marketOrderIds },
            status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] },
          },
          data: { courierId },
        })
        count += r.count
      }
      await this.notifyCourierNewOrders(courierId, count)
      return { count }
    }

    if (opts.condominiumId && opts.date) {
      // Atribuicao por condominiumId + date (query em 2 etapas)
      const date = new Date(opts.date)
      const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
      const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))

      // Etapa 1: buscar orders do condominio na data — gate: só separados ou já em rota
      const orders = await this.prisma.order.findMany({
        where: {
          condominiumId: opts.condominiumId,
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] },
        },
        select: { id: true },
      })

      if (orders.length === 0) return { count: 0 }

      // Etapa 2: atualizar courierId nas orders encontradas
      const result = await this.prisma.order.updateMany({
        where: { id: { in: orders.map((o: { id: string }) => o.id) } },
        data: { courierId },
      })
      // Cestinha pega carona: mesmo courier nos MarketOrder do condomínio no dia.
      await assignMarketByCondoDay(this.prisma, opts.condominiumId, startOfDay, endOfDay, courierId)
      await this.notifyCourierNewOrders(courierId, result.count)
      return { count: result.count }
    }

    throw { statusCode: 400, message: 'Informe orderIds ou condominiumId+date para atribuicao' }
  }

  /**
   * Aprova a divisão de entregas: grava o courierId e DESPACHA os pedidos
   * (SEPARATED → OUT_FOR_DELIVERY) em uma operação por entregador.
   *
   * Gate: aceita SEPARATED (despacho inicial) e OUT_FOR_DELIVERY (re-roteamento
   * ao "Reabrir divisão" — troca o courierId de uma entrega pendente sem reabrir
   * o pedido). DELIVERED/NOT_DELIVERED/CANCELLED ficam de fora, então a operação
   * segue idempotente e segura: reaprovar nunca mexe em quem já foi entregue/falhou.
   * A aprovação passa a ser derivável do próprio estado dos pedidos (existem pedidos
   * OUT_FOR_DELIVERY+ com courierId no dia/turno), sem precisar de flag extra no schema.
   */
  async approveDivision(
    assignments: { courierId: string; orderIds: string[]; marketOrderIds?: string[] }[],
  ): Promise<{ count: number }> {
    let count = 0
    for (const a of assignments) {
      const orderIds = a.orderIds ?? []
      const marketOrderIds = a.marketOrderIds ?? []
      if (orderIds.length === 0 && marketOrderIds.length === 0) continue

      let dispatched = 0
      if (orderIds.length > 0) {
        const result = await this.prisma.order.updateMany({
          where: { id: { in: orderIds }, status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] } },
          data: { courierId: a.courierId, status: 'OUT_FOR_DELIVERY' },
        })
        dispatched += result.count
        // Cestinha pega carona: despacha os MarketOrder do escopo dos pedidos deste entregador
        // (paradas combinadas — casa por userId).
        const scopeOrders = await this.prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { userId: true, condominiumId: true, slotId: true, scheduledDate: true },
        })
        await dispatchMarketForOrders(this.prisma, scopeOrders, a.courierId, true)
      }

      // Paradas SÓ-Cestinha: despacho EXPLÍCITO pelos ids que a divisão devolveu. Sem isto elas
      // dependiam do guard `courierId: null` de `dispatchMarketForOrders` (o 1º entregador
      // processado levava, sem o admin poder escolher) — e um condomínio/turno só com Cestinha
      // não tinha `orderIds`, logo nunca era despachado.
      if (marketOrderIds.length > 0) {
        const r = await this.prisma.marketOrder.updateMany({
          where: {
            id: { in: marketOrderIds },
            status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] },
          },
          data: { courierId: a.courierId, status: 'OUT_FOR_DELIVERY' },
        })
        dispatched += r.count
      }

      count += dispatched
    }
    // Turno OFERECIDO a cada entregador (plano-termos-legais §5): cria/atualiza a oferta e avisa
    // "Turno da manhã: N paradas · aceitar ou recusar" — substitui o "Novas entregas" daqui.
    await syncShiftOffers(this.fastify, await this.shiftKeysOf(assignments))
    // Rota de cada entregador/turno: prédio novo (fora da rota salva) → sugestão para o admin (D-5).
    await this.suggestRoutesAfterDivision(assignments)
    // Gancho na rota (A7): o gancho enviado para o dia/turno vai com o entregador da parada.
    await this.dispatchHooksAfterDivision(assignments)
    return { count }
  }

  /** Dias/turnos das paradas de uma divisão (para acertar as ofertas de turno). */
  private async shiftKeysOf(assignments: { courierId: string; orderIds: string[]; marketOrderIds?: string[] }[]): Promise<ShiftKey[]> {
    const orderIds = assignments.flatMap((a) => a.orderIds ?? [])
    const marketIds = assignments.flatMap((a) => a.marketOrderIds ?? [])
    const [orders, markets] = await Promise.all([
      orderIds.length ? this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { slotId: true, scheduledDate: true } }) : [],
      marketIds.length ? this.prisma.marketOrder.findMany({ where: { id: { in: marketIds } }, select: { slotId: true, scheduledDate: true } }) : [],
    ])
    return [...orders, ...markets].flatMap((o) => (o.slotId ? [{ date: brtDateStr(o.scheduledDate), slotId: o.slotId }] : []))
  }

  /**
   * Despacho dos ganchos enviados na rota (A7): para cada parada da divisão, o gancho do cliente
   * marcado para aquele dia/turno passa a ter o entregador da parada. Best-effort.
   */
  private async dispatchHooksAfterDivision(assignments: { courierId: string; orderIds: string[]; marketOrderIds?: string[] }[]): Promise<void> {
    try {
      for (const a of assignments) {
        const [orders, markets] = await Promise.all([
          a.orderIds?.length ? this.prisma.order.findMany({ where: { id: { in: a.orderIds } }, select: { userId: true, slotId: true, scheduledDate: true } }) : [],
          a.marketOrderIds?.length ? this.prisma.marketOrder.findMany({ where: { id: { in: a.marketOrderIds } }, select: { userId: true, slotId: true, scheduledDate: true } }) : [],
        ])
        const stops = new Map<string, { userId: string; slotId: string; date: string }>()
        for (const o of [...orders, ...markets]) {
          if (!o.slotId) continue
          const date = brtDateStr(o.scheduledDate)
          stops.set(`${o.userId}|${o.slotId}|${date}`, { userId: o.userId, slotId: o.slotId, date })
        }
        for (const st of stops.values()) {
          await this.prisma.hookRequest.updateMany({
            where: { userId: st.userId, status: 'REQUESTED', routeDate: st.date, routeSlotId: st.slotId },
            data: { routeCourierId: a.courierId },
          })
        }
      }
    } catch (err) {
      this.fastify.log.warn({ err }, '[admin-orders] falha ao despachar os ganchos da rota — ignorado')
    }
  }

  /**
   * Depois da divisão aprovada, compara os prédios de cada entregador/turno com a rota salva e,
   * se entrou prédio novo, calcula a sugestão (`ADMIN_ROUTE_SUGGESTION`). Best-effort: a divisão
   * já foi gravada, e nada aqui pode desfazê-la.
   */
  private async suggestRoutesAfterDivision(assignments: { courierId: string; orderIds: string[]; marketOrderIds?: string[] }[]): Promise<void> {
    try {
      const slots = await getGlobalDeliverySlots(this.prisma)
      for (const a of assignments) {
        const [orders, markets] = await Promise.all([
          a.orderIds?.length ? this.prisma.order.findMany({ where: { id: { in: a.orderIds } }, select: { slotId: true, condominiumId: true } }) : [],
          a.marketOrderIds?.length ? this.prisma.marketOrder.findMany({ where: { id: { in: a.marketOrderIds } }, select: { slotId: true, condominiumId: true } }) : [],
        ])
        const bySlot = new Map<string, Set<string>>()
        for (const o of [...orders, ...markets]) {
          if (!o.slotId || !o.condominiumId) continue
          const set = bySlot.get(o.slotId) ?? new Set<string>()
          set.add(o.condominiumId)
          bySlot.set(o.slotId, set)
        }
        for (const [slotId, ids] of bySlot) {
          const rows = await this.prisma.condominium.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, lat: true, lng: true } })
          await ensureSuggestion(this.fastify, {
            courierId: a.courierId,
            slotId,
            condos: rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat ?? null, lng: r.lng ?? null })),
            slotLabel: slots.find((s) => s.slotId === slotId)?.label ?? slotId,
          })
        }
      }
    } catch (err) {
      this.fastify.log.warn({ err }, '[admin-orders] falha ao sugerir rotas depois da divisão — ignorado')
    }
  }

  /**
   * Retorna KPIs do painel admin para o dia atual (BRT).
   *
   * T-07-06-01: preHandler authenticate + role check ADMIN garantem que apenas admins acessam.
   * KPIs: breadsTodayCount, revenueToday, clientsCount, condominiumsCount, deliverySlots, revenueByType.
   */
  async getDashboard(): Promise<{
    breadsTodayCount: number
    breadsTodayProjected: number
    breadsTomorrowCount: number
    breadsTomorrowProjected: number
    breadsByWeekday: number[]
    /** Itens do mercadinho por dia da semana — métrica paralela aos pães (D-1). */
    itemsByWeekday: number[]
    revenueToday: number
    breadsTodayTrendPct: number
    revenueTrendPct: number
    clientsCount: number
    clientsNewCount: number
    condominiumsCount: number
    deliverySlots: Array<{ slotId: string; label: string; time: string; cutoffTime: string }>
    revenueByType: { combos: number; avulso: number }
    /**
     * Cestinha de hoje (D-2) — `revenue` é dinheiro NOVO (Payment purpose=MARKET) e entra no
     * consolidado; `gmv` é valor movimentado e **nunca** é somado à receita. Card "Receita do dia"
     * não subir numa Cestinha 100% crédito é o comportamento CORRETO: aquele dinheiro foi faturado
     * quando o combo foi comprado. Quem sobe é o GMV.
     */
    marketToday: { revenue: number; gmv: number; orders: number }
    /** `revenueToday` + `marketToday.revenue`. Sem GMV. */
    revenueTodayConsolidated: number
    stuckCount: number
  }> {
    // Calcular início e fim do dia em BRT (UTC-3)
    const now = new Date()
    const nowBrtString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    // nowBrtString ex: "15/06/2026" → converter para Date UTC de início do dia
    const [day, month, year] = nowBrtString.split('/')
    const startOfDayBrt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0, 0)) // BRT = UTC-3, então início do dia BRT = 03:00 UTC
    const endOfDayBrt = new Date(startOfDayBrt.getTime() + 24 * 60 * 60 * 1000 - 1)
    // Janela de amanhã BRT (para o card "Pedido de amanhã")
    const startOfTomorrowBrt = new Date(startOfDayBrt.getTime() + 24 * 60 * 60 * 1000)
    const endOfTomorrowBrt = new Date(startOfTomorrowBrt.getTime() + 24 * 60 * 60 * 1000 - 1)
    // Base dos deltas dos badges: o MESMO DIA DA SEMANA anterior, não ontem.
    //
    // Era ontem, e isso fazia os dois badges do painel mentirem por calendário: toda segunda-feira
    // aparecia despencando contra o domingo e todo domingo subindo contra o sábado. A demanda de
    // pão é semanal (a agenda do cliente é por dia da semana), então segunda só se compara com
    // segunda. Os nomes dos campos seguem `*TrendPct` porque é exatamente o que eles passaram a
    // ser — tendência, e não oscilação de um dia para o outro.
    const startOfPrevWeekdayBrt = new Date(startOfDayBrt.getTime() - 7 * 24 * 60 * 60 * 1000)
    const endOfPrevWeekdayBrt = new Date(startOfPrevWeekdayBrt.getTime() + 24 * 60 * 60 * 1000 - 1)
    // Meio-dia BRT de hoje/amanhã (seguro p/ projeção da agenda — cai dentro do dia)
    const todayNoonBrt = new Date(startOfDayBrt.getTime() + 12 * 60 * 60 * 1000)
    const tomorrowNoonBrt = new Date(todayNoonBrt.getTime() + 24 * 60 * 60 * 1000)
    // Semana corrente (segunda→domingo) em BRT, para o gráfico "Fornadas por dia"
    const dow = startOfDayBrt.getUTCDay() // 0=Dom..6=Sáb (mesmo dia BRT às 03:00 UTC)
    const daysFromMonday = (dow + 6) % 7
    const weekStart = new Date(startOfDayBrt.getTime() - daysFromMonday * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    // 7 dias atrás (para "novos clientes")
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      orderAgg,
      orderTomorrowAgg,
      orderPrevWeekdayAgg,
      marketTodayAgg,
      marketTomorrowAgg,
      marketPrevWeekdayAgg,
      weekMarket,
      paymentAgg,
      paymentPrevWeekdayAgg,
      clientsCount,
      clientsNewCount,
      condominiumsCount,
      deliverySlotsConfig,
      comboPaidPayments,
      avulsoPaidPayments,
      weekOrders,
      projToday,
      projTomorrow,
      stuckCount,
      marketStuckCount,
      marketRevenueTodayAgg,
      marketGmvTodayAgg,
    ] = await Promise.all([
      // breadsTodayCount
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { scheduledDate: { gte: startOfDayBrt, lte: endOfDayBrt }, status: { not: 'CANCELLED' } },
      }),
      // breadsTomorrowCount — base do card "Pedido de amanhã"
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { scheduledDate: { gte: startOfTomorrowBrt, lte: endOfTomorrowBrt }, status: { not: 'CANCELLED' } },
      }),
      // breads do mesmo dia da semana anterior (delta do card "Pães hoje")
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { scheduledDate: { gte: startOfPrevWeekdayBrt, lte: endOfPrevWeekdayBrt }, status: { not: 'CANCELLED' } },
      }),
      // Pães vendidos DENTRO da Cestinha (D-1: breadQty é pão e conta em todo contador de pães).
      // Três janelas espelhando as agregações de Order acima.
      this.prisma.marketOrder.aggregate({
        _sum: { breadQty: true },
        where: { scheduledDate: { gte: startOfDayBrt, lte: endOfDayBrt }, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
      }),
      this.prisma.marketOrder.aggregate({
        _sum: { breadQty: true },
        where: { scheduledDate: { gte: startOfTomorrowBrt, lte: endOfTomorrowBrt }, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
      }),
      this.prisma.marketOrder.aggregate({
        _sum: { breadQty: true },
        where: { scheduledDate: { gte: startOfPrevWeekdayBrt, lte: endOfPrevWeekdayBrt }, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
      }),
      // Cestinhas da semana — alimenta o gráfico "Fornadas por dia" com o pão da Cestinha.
      this.prisma.marketOrder.findMany({
        where: { scheduledDate: { gte: weekStart, lte: weekEnd }, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
        select: { scheduledDate: true, breadQty: true, items: { select: { qty: true } } },
      }),
      // revenueToday (§4.7: exclui HOOK/MARKET — receita de crédito apenas)
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt }, ...excludeNonCreditPurpose },
      }),
      // revenue de ontem (delta do card "Receita do dia")
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: startOfPrevWeekdayBrt, lte: endOfPrevWeekdayBrt }, ...excludeNonCreditPurpose },
      }),
      // clientsCount
      this.prisma.user.count({ where: { role: 'CLIENT', isBlocked: false } }),
      // clientsNewCount — novos clientes nos últimos 7 dias (delta do card "Clientes")
      this.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: sevenDaysAgo } } }),
      // condominiumsCount
      this.prisma.condominium.count({ where: { isActive: true } }),
      // deliverySlots (config global — cutoffTime por slot)
      getGlobalDeliverySlots(this.prisma),
      // revenueByType — combos (comboId != null)
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt }, comboId: { not: null } },
        select: { amount: true },
      }),
      // revenueByType — avulso (customQuantity != null)
      // NB: usamos customQuantity em vez de `comboId: null` porque pagamentos avulsos
      // são criados SEM o campo comboId (unset no Mongo), e `comboId: null` no Prisma
      // não casa com campos ausentes — só com null explícito.
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt }, customQuantity: { not: null } },
        select: { amount: true },
      }),
      // pedidos da semana corrente (gráfico "Fornadas por dia")
      this.prisma.order.findMany({
        where: { scheduledDate: { gte: weekStart, lte: weekEnd }, status: { not: 'CANCELLED' } },
        select: { scheduledDate: true, quantity: true },
      }),
      // projeção da agenda (previstos não materializados) — hoje e amanhã
      projectScheduleForDate(this.prisma, todayNoonBrt),
      projectScheduleForDate(this.prisma, tomorrowNoonBrt),
      // pedidos "no limbo": data passada e ainda sem desfecho
      this.prisma.order.count({
        where: {
          scheduledDate: { lt: startOfDayBrt },
          status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] },
        },
      }),
      // Cestinhas no limbo — mesma regra. Sem isto uma Cestinha esquecida sumia em silêncio,
      // com o crédito do cliente já debitado e o estoque do produto reservado.
      this.prisma.marketOrder.count({
        where: {
          scheduledDate: { lt: startOfDayBrt },
          status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] },
        },
      }),
      // D2 — a Cestinha no painel (D-2): dinheiro NOVO × valor movimentado, na janela da COMPRA
      // (`createdAt`), a mesma do `revenueToday`.
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', purpose: 'MARKET', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt } },
      }),
      this.prisma.marketOrder.aggregate({
        _sum: { totalValue: true },
        _count: true,
        where: {
          createdAt: { gte: startOfDayBrt, lte: endOfDayBrt },
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
        },
      }),
    ])

    const combosRevenue = (comboPaidPayments as { amount: number }[]).reduce((s, p) => s + p.amount, 0)
    const avulsoRevenue = (avulsoPaidPayments as { amount: number }[]).reduce((s, p) => s + p.amount, 0)

    // Série por dia da semana (seg..dom) a partir dos pedidos materializados da semana + o pão
    // vendido na Cestinha. `itemsByWeekday` é a métrica PARALELA dos produtos do mercadinho —
    // nunca somada aos pães (D-1): "18 pães" não pode ser 12 pães + 6 potes de geleia.
    const WEEKDAY_INDEX: Record<DayKey, number> = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4, sab: 5, dom: 6 }
    const breadsByWeekday = [0, 0, 0, 0, 0, 0, 0]
    const itemsByWeekday = [0, 0, 0, 0, 0, 0, 0]
    for (const o of weekOrders as { scheduledDate: Date; quantity: number }[]) {
      breadsByWeekday[WEEKDAY_INDEX[dayKeyOf(o.scheduledDate)]] += o.quantity
    }
    for (const m of weekMarket as { scheduledDate: Date; breadQty: number; items: { qty: number }[] }[]) {
      const idx = WEEKDAY_INDEX[dayKeyOf(m.scheduledDate)]
      breadsByWeekday[idx] += m.breadQty
      itemsByWeekday[idx] += m.items.reduce((n, i) => n + i.qty, 0)
    }

    // Pães do dia = pedidos de pão + pão da Cestinha (D-1).
    const marketBreadsToday = (marketTodayAgg._sum?.breadQty as number | null) ?? 0
    const marketBreadsTomorrow = (marketTomorrowAgg._sum?.breadQty as number | null) ?? 0
    const marketBreadsPrevWeekday = (marketPrevWeekdayAgg._sum?.breadQty as number | null) ?? 0
    const breadsToday = ((orderAgg._sum?.quantity as number | null) ?? 0) + marketBreadsToday
    const breadsPrevWeekday = ((orderPrevWeekdayAgg._sum?.quantity as number | null) ?? 0) + marketBreadsPrevWeekday
    const revenueToday = (paymentAgg._sum?.amount as number | null) ?? 0
    const revenuePrevWeekday = (paymentPrevWeekdayAgg._sum?.amount as number | null) ?? 0
    const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0)

    return {
      breadsTodayCount: breadsToday,
      breadsTodayProjected: projToday.total,
      breadsTomorrowCount: ((orderTomorrowAgg._sum?.quantity as number | null) ?? 0) + marketBreadsTomorrow,
      breadsTomorrowProjected: projTomorrow.total,
      breadsByWeekday,
      itemsByWeekday,
      revenueToday,
      breadsTodayTrendPct: pct(breadsToday, breadsPrevWeekday),
      revenueTrendPct: pct(revenueToday, revenuePrevWeekday),
      clientsCount,
      clientsNewCount,
      condominiumsCount,
      deliverySlots: deliverySlotsConfig
        .filter((s) => s.isActive)
        .map((s) => ({ slotId: s.slotId, label: s.label, time: s.time, cutoffTime: s.cutoffTime })),
      revenueByType: { combos: combosRevenue, avulso: avulsoRevenue },
      marketToday: {
        revenue: round2((marketRevenueTodayAgg._sum?.amount as number | null) ?? 0),
        gmv: round2((marketGmvTodayAgg._sum?.totalValue as number | null) ?? 0),
        orders: marketGmvTodayAgg._count as number,
      },
      revenueTodayConsolidated: round2(
        revenueToday + ((marketRevenueTodayAgg._sum?.amount as number | null) ?? 0),
      ),
      stuckCount: (stuckCount as number) + (marketStuckCount as number),
    }
  }

  /**
   * Retorna o status de entregas do dia agrupadas por condomínio.
   *
   * Gate da separação: busca Orders de hoje BRT já no estágio de entrega
   * (SEPARATED/OUT_FOR_DELIVERY/DELIVERED/NOT_DELIVERED), agrupa por condominiumId.
   * Para cada grupo: nome do condomínio, total no pipeline, total DELIVERED, orderIds.
   * orderIds é necessário para o frontend chamar assign-courier em batch (07-09).
   */
  /** Janela do dia BRT para a data informada (YYYY-MM-DD); default = hoje. */
  private resolveDayRange(dateStr?: string): { start: Date; end: Date } {
    const ds = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : brtDateStr(new Date(), 0)
    return brtDayRange(brtNoonFromStr(ds))
  }

  async getDeliveryStatus(slotId?: string, dateStr?: string): Promise<DeliveryStatusRow[]> {
    const { start, end } = this.resolveDayRange(dateStr)
    // Gate da separação: a operação de entrega só enxerga pedidos já SEPARADOS (e além).
    // SCHEDULED (não separado) e CANCELLED ficam de fora.
    const IN_DELIVERY = ['SEPARATED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as const

    const [breadOrders, marketOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          scheduledDate: { gte: start, lte: end },
          status: { in: [...IN_DELIVERY] },
          // Pipeline por turno: quando informado, filtra só o slot.
          ...(slotId ? { slotId } : {}),
        },
        select: { id: true, userId: true, condominiumId: true, status: true },
      }) as Promise<{ id: string; userId: string; condominiumId: string | null; status: string }[]>,
      // Cestinhas na esteira de entrega. Sem isto, uma parada só-Cestinha não existia para o
      // acompanhamento: o admin não via que havia entrega a fazer nem que ela tinha sido feita.
      this.prisma.marketOrder.findMany({
        where: {
          scheduledDate: { gte: start, lte: end },
          status: { in: [...IN_DELIVERY] },
          ...(slotId ? { slotId } : {}),
        },
        select: { id: true, userId: true, condominiumId: true, status: true },
      }) as Promise<{ id: string; userId: string; condominiumId: string; status: string }[]>,
    ])

    if (breadOrders.length === 0 && marketOrders.length === 0) return []

    // D-5: a unidade é a PARADA (cliente + condomínio). Pão + Cestinha do mesmo cliente = 1 parada,
    // "entregue" só quando ambos foram entregues — o entregador toca a campainha uma vez.
    type Stop = {
      userId: string
      condominiumId: string
      orderIds: string[]
      marketOrderIds: string[]
      total: number
      done: number
    }
    const stops = new Map<string, Stop>()
    const ensure = (userId: string, condoId: string): Stop => {
      const key = `${userId}|${condoId}`
      let s = stops.get(key)
      if (!s) {
        s = { userId, condominiumId: condoId, orderIds: [], marketOrderIds: [], total: 0, done: 0 }
        stops.set(key, s)
      }
      return s
    }

    for (const o of breadOrders) {
      const s = ensure(o.userId, o.condominiumId ?? 'unknown')
      s.orderIds.push(o.id)
      s.total += 1
      if (o.status === 'DELIVERED') s.done += 1
    }
    for (const m of marketOrders) {
      const s = ensure(m.userId, m.condominiumId)
      s.marketOrderIds.push(m.id)
      s.total += 1
      if (m.status === 'DELIVERED') s.done += 1
    }

    const stopList = [...stops.values()]
    const blockMap = await this.resolveUserBlocks(stopList.map((s) => s.userId))
    const condoIds = [...new Set(stopList.map((s) => s.condominiumId))].filter((id) => id !== 'unknown')
    const condominiumNameMap = await this.resolveCondoNames(condoIds)

    // Agrupa paradas por condomínio
    const byCondo = new Map<string, Stop[]>()
    for (const s of stopList) {
      const list = byCondo.get(s.condominiumId) ?? []
      list.push(s)
      byCondo.set(s.condominiumId, list)
    }

    return [...byCondo.entries()].map(([condominiumId, condoStops]) => {
      const byBlock = new Map<string, DeliveryBlockStatus>()
      for (const s of condoStops) {
        const b = blockMap.get(s.userId) ?? ''
        if (!byBlock.has(b)) {
          byBlock.set(b, { block: b, scheduled: 0, delivered: 0, orderIds: [], marketOrderIds: [] })
        }
        const bg = byBlock.get(b)!
        bg.scheduled += 1
        if (s.done === s.total) bg.delivered += 1
        bg.orderIds.push(...s.orderIds)
        bg.marketOrderIds.push(...s.marketOrderIds)
      }
      const blocks = [...byBlock.values()].sort((a, b) =>
        a.block.localeCompare(b.block, 'pt-BR', { numeric: true }),
      )
      return {
        condominiumId,
        condominiumName: condominiumNameMap.get(condominiumId) ?? condominiumId,
        scheduled: condoStops.length,
        delivered: condoStops.filter((s) => s.done === s.total).length,
        orderIds: condoStops.flatMap((s) => s.orderIds),
        marketOrderIds: condoStops.flatMap((s) => s.marketOrderIds),
        blocks,
      }
    })
  }

  /**
   * Estado da divisão de entregas do dia/turno.
   *
   * Dois modos, derivados do estado dos próprios pedidos (sem flag extra):
   *  - approved=false → ainda não despachado: sugestão GREEDY (D-10) sobre os pedidos
   *    SEPARATED do dia/turno (ordena condomínios por quantity desc, aloca ao entregador
   *    com menor total acumulado). O admin pode reatribuir manualmente antes de aprovar.
   *  - approved=true → já despachado: devolve a divisão REAL persistida, agrupada pelo
   *    courierId gravado nos pedidos OUT_FOR_DELIVERY/DELIVERED/NOT_DELIVERED. É o que
   *    faz o badge "Aprovada" sobreviver a reload / saída de tela.
   *
   *  - aprovada, mas com paradas SEPARATED sem entregador (o entregador RECUSOU o turno, ou houve
   *    separação depois da aprovação) → volta à sugestão SÓ dessas paradas, com `partial` (quantas
   *    já estão na rua) e `declined` (quem recusou fica fora da sugestão, como `RECUSOU`).
   *
   * Pipeline por turno: com slotId, a divisão é só daquele turno (entregador nunca
   * recebe manhã+tarde misturados).
   * Retorna: { approved, assignments: [{ courierId, courierName, condominiums, total }], partial?, declined }
   */
  async getDivisionSuggestion(slotId?: string, dateStr?: string): Promise<{
    approved: boolean
    assignments: DivisionAssignment[]
    partial?: { dispatchedStops: number }
    declined: DivisionDeclined[]
  }> {
    // Buscar entregadores ativos
    const couriers = (await this.prisma.user.findMany({
      where: { role: 'COURIER', isBlocked: false },
      select: { id: true, name: true },
    })) as { id: string; name: string }[]

    if (couriers.length === 0) return { approved: false, assignments: [], declined: [] }

    const { start, end } = this.resolveDayRange(dateStr)
    const dayStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : brtDateStr(new Date(), 0)
    const declined = await this.declinedShifts(dayStr, slotId, couriers)

    // 1) Estado pós-aprovação: se já há paradas despachadas (com entregador) no dia/turno,
    // a divisão foi aprovada — devolvemos a divisão REAL persistida (não a sugestão greedy).
    const dispatched = await this.collectDivisionStops(start, end, slotId, 'dispatched')
    // 2) Paradas SEPARATED: antes da aprovação, tudo; depois, as que sobraram sem entregador.
    const stops = await this.collectDivisionStops(start, end, slotId, 'separated')
    if (dispatched.length > 0 && stops.length === 0) {
      return { approved: true, assignments: await this.groupByCourier(couriers, dispatched), declined }
    }
    if (stops.length === 0) return { approved: false, assignments: [], declined }
    const partial = dispatched.length > 0 ? { dispatchedStops: dispatched.length } : undefined

    // Agrupar por condominiumId (mantém as paradas cruas p/ ids + breakdown de blocos)
    const condoMap = new Map<string, DivisionStop[]>()
    for (const s of stops) {
      const condoId = s.condominiumId ?? 'unknown'
      if (!condoMap.has(condoId)) condoMap.set(condoId, [])
      condoMap.get(condoId)!.push(s)
    }

    const blockMap = await this.resolveUserBlocks(stops.map((s) => s.userId))
    const condominiumNameMap = await this.resolveCondoNames(
      Array.from(condoMap.keys()).filter((id) => id !== 'unknown'),
    )

    // Cada condomínio vira uma unidade "inteira" (block: null) que já carrega o
    // detalhamento por bloco para o admin "explodir" na tela.
    const sortedUnits: DivisionUnit[] = Array.from(condoMap.entries())
      .map(([condominiumId, items]) => ({
        condominiumId,
        condominiumName: condominiumNameMap.get(condominiumId) ?? condominiumId,
        block: null,
        quantity: items.reduce((s, o) => s + o.quantity, 0),
        items: items.reduce((s, o) => s + o.items, 0),
        orderIds: items.flatMap((o) => o.orderIds),
        marketOrderIds: items.flatMap((o) => o.marketOrderIds),
        blocks: this.buildDivisionBlocks(items, blockMap),
      }))
      // Peso da unidade = pães + itens: o entregador carrega os dois. Um condomínio com 0 pães e
      // 20 potes de geleia não é "leve"; ordenar só por pães o jogaria pro fim da fila.
      .sort((a, b) => b.quantity + b.items - (a.quantity + a.items))

    // Folga e escala (F-8): quem está fora no dia/turno não entra na sugestão. Se todo mundo
    // estiver fora, a sugestão usa todos (melhor sugerir do que deixar a divisão vazia). Quem recusou
    // o turno hoje também fica fora (plano-termos-legais §5).
    const off: Map<string, DivisionAssignment['offReason']> = new Map(await courierOffMap(this.prisma, couriers.map((c) => c.id), dayStr, slotId))
    for (const d of declined) off.set(d.courierId, 'RECUSOU')

    // Algoritmo greedy: inicializar contadores por entregador
    const courierList: DivisionAssignment[] = couriers.map((c) => ({
      courierId: c.id,
      courierName: c.name,
      condominiums: [],
      total: 0,
      totalItems: 0,
      offReason: off.get(c.id) ?? null,
    }))
    const eligible = courierList.some((c) => !c.offReason) ? courierList.filter((c) => !c.offReason) : courierList

    for (const unit of sortedUnits) {
      // Encontrar entregador com menor carga (pães + itens)
      let minIdx = 0
      for (let i = 1; i < eligible.length; i++) {
        const cur = eligible[i].total + eligible[i].totalItems
        const min = eligible[minIdx].total + eligible[minIdx].totalItems
        if (cur < min) minIdx = i
      }
      eligible[minIdx].condominiums.push(unit)
      eligible[minIdx].total += unit.quantity
      eligible[minIdx].totalItems += unit.items
    }

    // Retornar todos os entregadores ativos — inclusive os sem condomínio sugerido e os de folga
    // (no fim). A sugestão greedy acima já balanceia a carga; manter os entregadores vazios
    // permite que o admin reatribua condomínios manualmente (drag-and-drop no front).
    return { approved: false, assignments: [...courierList.filter((c) => !c.offReason), ...courierList.filter((c) => c.offReason)], partial, declined }
  }

  /**
   * Recusas de turno do dia (e do turno, se informado) que ainda valem: quem recusou e não recebeu
   * o turno de novo depois. Mais recente primeiro.
   */
  private async declinedShifts(date: string, slotId: string | undefined, couriers: { id: string; name: string }[]): Promise<DivisionDeclined[]> {
    const rows = await this.prisma.courierShiftOffer.findMany({ where: { date, ...(slotId ? { slotId } : {}) }, orderBy: { offeredAt: 'desc' } })
    const latest = new Map<string, (typeof rows)[number]>()
    for (const r of rows) if (!latest.has(`${r.courierId}|${r.slotId}`)) latest.set(`${r.courierId}|${r.slotId}`, r)
    const name = new Map(couriers.map((c) => [c.id, c.name]))
    return [...latest.values()]
      .filter((r) => r.status === 'DECLINED')
      .map((r) => ({ courierId: r.courierId, courierName: name.get(r.courierId) ?? 'Entregador', slotId: r.slotId, at: (r.respondedAt ?? r.updatedAt).toISOString(), reason: r.reason ?? null, stops: r.stops }))
      .sort((a, b) => b.at.localeCompare(a.at))
  }

  /**
   * collectDivisionStops — paradas do dia/turno para a divisão de entregas, unindo pedidos de pão
   * e Cestinhas por `(userId, condominiumId)` (D-5).
   *
   * @param mode 'separated'  → gate da separação: o que ainda vai ser dividido (sugestão greedy)
   *             'dispatched' → o que já foi despachado com entregador (divisão real aprovada)
   */
  private async collectDivisionStops(
    start: Date,
    end: Date,
    slotId: string | undefined,
    mode: 'separated' | 'dispatched',
  ): Promise<DivisionStop[]> {
    // `OrderStatus` e `MarketOrderStatus` compartilham estes valores de string de propósito
    // (a Cestinha pega carona na esteira do pão), então o mesmo filtro serve para os dois.
    const DISPATCHED = ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as const
    const statusFilter =
      mode === 'separated'
        ? { status: 'SEPARATED' as const }
        : { status: { in: [...DISPATCHED] }, courierId: { not: null } }

    const [orders, marketOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          scheduledDate: { gte: start, lte: end },
          ...statusFilter,
          ...(slotId ? { slotId } : {}),
        },
        select: { id: true, userId: true, condominiumId: true, quantity: true, courierId: true },
      }) as Promise<
        { id: string; userId: string; condominiumId: string | null; quantity: number; courierId: string | null }[]
      >,
      this.prisma.marketOrder.findMany({
        where: {
          scheduledDate: { gte: start, lte: end },
          ...statusFilter,
          ...(slotId ? { slotId } : {}),
        },
        select: {
          id: true,
          userId: true,
          condominiumId: true,
          breadQty: true,
          courierId: true,
          items: { select: { qty: true } },
        },
      }) as Promise<
        {
          id: string
          userId: string
          condominiumId: string
          breadQty: number
          courierId: string | null
          items: { qty: number }[]
        }[]
      >,
    ])

    const stops = new Map<string, DivisionStop>()
    const ensure = (userId: string, condoId: string | null): DivisionStop => {
      const key = `${userId}|${condoId ?? 'unknown'}`
      let s = stops.get(key)
      if (!s) {
        s = { userId, condominiumId: condoId, quantity: 0, items: 0, orderIds: [], marketOrderIds: [], courierId: null }
        stops.set(key, s)
      }
      return s
    }

    for (const o of orders) {
      const s = ensure(o.userId, o.condominiumId)
      s.quantity += o.quantity
      s.orderIds.push(o.id)
      // O pedido de pão manda no entregador da parada: numa parada combinada a Cestinha
      // acompanha o pão (foi a regra fiada na Onda 5 em `dispatchMarketForOrders`).
      if (o.courierId) s.courierId = o.courierId
    }
    for (const m of marketOrders) {
      const s = ensure(m.userId, m.condominiumId)
      s.quantity += m.breadQty
      s.items += m.items.reduce((n, i) => n + i.qty, 0)
      s.marketOrderIds.push(m.id)
      // Só assume o courier da Cestinha se a parada não tem pão (parada só-market).
      if (!s.courierId && m.courierId) s.courierId = m.courierId
    }

    return [...stops.values()]
  }

  /** Resolve nomes de condomínios para um conjunto de IDs (mapa id→nome). */
  private async resolveCondoNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const condos = (await this.prisma.condominium.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })) as { id: string; name: string }[]
    return new Map(condos.map((c) => [c.id, c.name]))
  }

  /** Resolve o bloco (User.block) de um conjunto de userIds (mapa userId→bloco, '' se vazio). */
  private async resolveUserBlocks(userIds: string[]): Promise<Map<string, string>> {
    const ids = Array.from(new Set(userIds))
    if (ids.length === 0) return new Map()
    const users = (await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, block: true },
    })) as { id: string; block: string | null }[]
    return new Map(users.map((u) => [u.id, (u.block ?? '').trim()]))
  }

  /**
   * Detalha os pedidos de um condomínio por bloco (pães + orderIds), ordenado por bloco
   * numérico. Alimenta a "explosão" de um condomínio em blocos na divisão de entregas.
   */
  private buildDivisionBlocks(stops: DivisionStop[], blockMap: Map<string, string>): DivisionBlock[] {
    const byBlock = new Map<string, DivisionBlock>()
    for (const s of stops) {
      const b = blockMap.get(s.userId) ?? ''
      if (!byBlock.has(b)) {
        byBlock.set(b, { block: b, quantity: 0, orderIds: [], marketOrderIds: [], items: 0 })
      }
      const g = byBlock.get(b)!
      g.quantity += s.quantity
      g.items += s.items
      g.orderIds.push(...s.orderIds)
      g.marketOrderIds.push(...s.marketOrderIds)
    }
    return Array.from(byBlock.values()).sort((a, b) =>
      a.block.localeCompare(b.block, 'pt-BR', { numeric: true }),
    )
  }

  /**
   * Agrupa pedidos já despachados por entregador → condomínio (com nomes resolvidos).
   * Inclui todos os entregadores ativos — os sem pedido aparecem com total 0, mantendo
   * a UI consistente com a sugestão greedy.
   */
  private async groupByCourier(
    couriers: { id: string; name: string }[],
    stops: DivisionStop[],
  ): Promise<DivisionAssignment[]> {
    // Detecta condomínios "split" (paradas em >1 entregador) — esses viram unidades por
    // bloco; os demais permanecem como unidade de condomínio inteiro.
    const couriersByCondo = new Map<string, Set<string>>()
    for (const s of stops) {
      if (!s.courierId || !s.condominiumId) continue
      if (!couriersByCondo.has(s.condominiumId)) couriersByCondo.set(s.condominiumId, new Set())
      couriersByCondo.get(s.condominiumId)!.add(s.courierId)
    }
    const isSplit = (condoId: string) => (couriersByCondo.get(condoId)?.size ?? 0) > 1

    // Agrupa paradas por entregador
    const byCourier = new Map<string, DivisionStop[]>()
    for (const s of stops) {
      if (!s.courierId) continue
      if (!byCourier.has(s.courierId)) byCourier.set(s.courierId, [])
      byCourier.get(s.courierId)!.push(s)
    }

    const blockMap = await this.resolveUserBlocks(stops.map((s) => s.userId))
    const condoIds = Array.from(
      new Set(stops.map((s) => s.condominiumId).filter((id): id is string => !!id)),
    )
    const condoNameMap = await this.resolveCondoNames(condoIds)

    return couriers.map((c) => {
      const cStops = byCourier.get(c.id) ?? []
      // Agrupa as paradas deste entregador por condomínio
      const byCondo = new Map<string, DivisionStop[]>()
      for (const s of cStops) {
        const condoId = s.condominiumId ?? 'unknown'
        if (!byCondo.has(condoId)) byCondo.set(condoId, [])
        byCondo.get(condoId)!.push(s)
      }

      const units: DivisionUnit[] = []
      for (const [condominiumId, items] of byCondo) {
        const condominiumName = condoNameMap.get(condominiumId) ?? condominiumId
        const blocks = this.buildDivisionBlocks(items, blockMap)
        if (isSplit(condominiumId)) {
          // Condomínio dividido entre entregadores → uma unidade por bloco (deste entregador).
          for (const b of blocks) {
            units.push({
              condominiumId,
              condominiumName,
              block: b.block,
              quantity: b.quantity,
              items: b.items,
              orderIds: b.orderIds,
              marketOrderIds: b.marketOrderIds,
              blocks: [],
            })
          }
        } else {
          units.push({
            condominiumId,
            condominiumName,
            block: null,
            quantity: items.reduce((s, o) => s + o.quantity, 0),
            items: items.reduce((s, o) => s + o.items, 0),
            orderIds: items.flatMap((o) => o.orderIds),
            marketOrderIds: items.flatMap((o) => o.marketOrderIds),
            blocks,
          })
        }
      }
      units.sort((a, b) => b.quantity + b.items - (a.quantity + a.items))
      return {
        courierId: c.id,
        courierName: c.name,
        condominiums: units,
        total: units.reduce((s, x) => s + x.quantity, 0),
        totalItems: units.reduce((s, x) => s + x.items, 0),
      }
    })
  }

  /**
   * _enrichOrders — enriquece pedidos com nome do cliente, condomínio, label do slot,
   * entregador e flag de estorno. Campos nulos viram '' (evita strip do response schema).
   */
  private async _enrichOrders(
    orders: Array<{
      id: string
      userId: string
      quantity: number
      slotId: string | null
      type: string
      status: string
      condominiumId: string | null
      courierId: string | null
      scheduledDate: Date
      separatedAt: Date | null
      deliveredAt: Date | null
      failedAt: Date | null
      failureReason: string | null
      cancelReason: string | null
      deliveryNote: string | null
      paymentId: string | null
    }>,
  ): Promise<LedgerRow[]> {
    if (orders.length === 0) return []

    const userIds = [...new Set(orders.map((o) => o.userId))]
    const condoIds = [...new Set(orders.map((o) => o.condominiumId).filter((c): c is string => !!c))]
    const courierIds = [...new Set(orders.map((o) => o.courierId).filter((c): c is string => !!c))]
    const paymentIds = [...new Set(orders.map((o) => o.paymentId).filter((p): p is string => !!p))]
    const orderIds = orders.map((o) => o.id)

    const [users, condos, couriers, refunds, payments, firstDayByUser] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true, complement: true },
      }),
      this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true, deliverySlots: true },
      }),
      courierIds.length
        ? this.prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } })
        : Promise.resolve([] as { id: string; name: string }[]),
      this.prisma.creditTransaction.findMany({
        where: { type: 'REFUND', referenceId: { in: orderIds } },
        select: { referenceId: true },
      }),
      paymentIds.length
        ? this.prisma.payment.findMany({
            where: { id: { in: paymentIds } },
            select: { id: true, amount: true, status: true },
          })
        : Promise.resolve([] as { id: string; amount: number; status: PaymentStatus }[]),
      firstDeliveryDayByUser(this.prisma, userIds),
    ])

    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))
    const courierById = new Map(couriers.map((c) => [c.id, c]))
    const refundedSet = new Set(refunds.map((r) => r.referenceId).filter((id): id is string => !!id))
    const paymentById = new Map(payments.map((p) => [p.id, p]))

    const slotLabelFor = (condoId: string | null, slotId: string): string => {
      const condo = condoId ? condoById.get(condoId) : undefined
      const slot = condo?.deliverySlots?.find((s) => s.slotId === slotId || s.name === slotId)
      return slot?.label ?? fallbackSlotLabel(slotId)
    }

    return orders.map((o) => {
      const u = userById.get(o.userId)
      const slotId = o.slotId ?? ''
      return {
        kind: 'BREAD' as const,
        orderId: o.id,
        marketOrderId: '',
        userId: o.userId,
        clientName: u?.name ?? 'Cliente',
        condominiumId: o.condominiumId ?? '',
        condominiumName: (o.condominiumId && condoById.get(o.condominiumId)?.name) || '—',
        block: u?.block ?? '',
        complement: u?.complement ?? '',
        apartment: u?.apartment ?? '',
        quantity: o.quantity,
        slotId,
        slotLabel: slotLabelFor(o.condominiumId, slotId),
        type: o.type,
        status: o.status,
        scheduledDate: o.scheduledDate.toISOString(),
        courierId: o.courierId ?? '',
        courierName: (o.courierId && courierById.get(o.courierId)?.name) || '',
        separatedAt: o.separatedAt ? o.separatedAt.toISOString() : '',
        deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : '',
        failedAt: o.failedAt ? o.failedAt.toISOString() : '',
        failureReason: o.failureReason ?? '',
        cancelReason: o.cancelReason ?? '',
        deliveryNote: o.deliveryNote ?? '',
        refunded: refundedSet.has(o.id),
        paymentId: o.paymentId ?? '',
        paymentAmount: (o.paymentId && paymentById.get(o.paymentId)?.amount) || 0,
        paymentStatus: (o.paymentId && paymentById.get(o.paymentId)?.status) || '',
        marketItems: [],
        marketItemCount: 0,
        creditsApplied: 0,
        moneyAmount: 0,
        totalValue: 0,
        isFirstOrder: isFirstDelivery(firstDayByUser.get(o.userId), o.scheduledDate),
      }
    })
  }

  /**
   * _enrichMarketOrders — mesma coisa para Cestinhas (D-4): transforma `MarketOrder` em `LedgerRow`
   * com `kind: 'CESTINHA'`, para que apareçam na MESMA lista dos pedidos de pão.
   *
   * `quantity` é o `breadQty` (pães da Cestinha — pode ser 0 quando o pedido é só de produtos) e os
   * produtos ficam em `marketItems`, nunca somados aos pães (D-1). `refunded` olha `MARKET_REFUND`
   * (não `REFUND`), que é o tipo usado pelo estorno da Cestinha.
   */
  private async _enrichMarketOrders(
    orders: Array<{
      id: string
      userId: string
      condominiumId: string
      slotId: string
      status: string
      breadQty: number
      scheduledDate: Date
      separatedAt: Date | null
      deliveredAt: Date | null
      failedAt: Date | null
      failureReason: string | null
      cancelReason: string | null
      paymentId: string | null
      creditsAppliedMilli: number | null
      moneyAmount: number
      totalValue: number
      items: { name: string; qty: number }[]
    }>,
  ): Promise<LedgerRow[]> {
    if (orders.length === 0) return []

    const userIds = [...new Set(orders.map((o) => o.userId))]
    const condoIds = [...new Set(orders.map((o) => o.condominiumId))]
    const paymentIds = [...new Set(orders.map((o) => o.paymentId).filter((p): p is string => !!p))]
    const orderIds = orders.map((o) => o.id)

    const [users, condos, refunds, payments, firstDayByUser] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true, complement: true },
      }),
      this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true, deliverySlots: true },
      }),
      this.prisma.creditTransaction.findMany({
        where: { type: 'MARKET_REFUND', referenceId: { in: orderIds } },
        select: { referenceId: true },
      }),
      paymentIds.length
        ? this.prisma.payment.findMany({
            where: { id: { in: paymentIds } },
            select: { id: true, amount: true, status: true },
          })
        : Promise.resolve([] as { id: string; amount: number; status: PaymentStatus }[]),
      firstDeliveryDayByUser(this.prisma, userIds),
    ])

    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))
    const refundedSet = new Set(refunds.map((r) => r.referenceId).filter((id): id is string => !!id))
    const paymentById = new Map(payments.map((p) => [p.id, p]))

    // Cestinha não tem entregador nomeado no ledger hoje (courierId existe mas o nome só é
    // resolvido no fluxo do pão) — resolvemos igual, para a linha ficar completa.
    const courierIds = [...new Set(orders.map((o) => (o as { courierId?: string | null }).courierId).filter((c): c is string => !!c))]
    const couriers = courierIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } })
      : []
    const courierById = new Map(couriers.map((c) => [c.id, c]))

    return orders.map((o) => {
      const u = userById.get(o.userId)
      const condo = condoById.get(o.condominiumId)
      const slot = condo?.deliverySlots?.find((s) => s.slotId === o.slotId || s.name === o.slotId)
      const courierId = (o as { courierId?: string | null }).courierId ?? ''
      return {
        kind: 'CESTINHA' as const,
        orderId: '',
        marketOrderId: o.id,
        userId: o.userId,
        clientName: u?.name ?? 'Cliente',
        condominiumId: o.condominiumId,
        condominiumName: condo?.name ?? '—',
        block: u?.block ?? '',
        complement: u?.complement ?? '',
        apartment: u?.apartment ?? '',
        quantity: o.breadQty,
        slotId: o.slotId,
        slotLabel: slot?.label ?? fallbackSlotLabel(o.slotId),
        type: 'MARKET',
        status: o.status,
        scheduledDate: o.scheduledDate.toISOString(),
        courierId,
        courierName: (courierId && courierById.get(courierId)?.name) || '',
        separatedAt: o.separatedAt ? o.separatedAt.toISOString() : '',
        deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : '',
        failedAt: o.failedAt ? o.failedAt.toISOString() : '',
        failureReason: o.failureReason ?? '',
        cancelReason: o.cancelReason ?? '',
        deliveryNote: '',
        refunded: refundedSet.has(o.id),
        paymentId: o.paymentId ?? '',
        paymentAmount: (o.paymentId && paymentById.get(o.paymentId)?.amount) || 0,
        paymentStatus: (o.paymentId && paymentById.get(o.paymentId)?.status) || '',
        marketItems: o.items.map((i) => ({ name: i.name, qty: i.qty })),
        marketItemCount: o.items.reduce((n, i) => n + i.qty, 0),
        // Pãezinhos DECIMAIS (o crédito é fracionado; o espelho legado é só arredondamento).
        creditsApplied: fromMilli((o.creditsAppliedMilli ?? 0)),
        moneyAmount: o.moneyAmount,
        totalValue: o.totalValue,
        isFirstOrder: isFirstDelivery(firstDayByUser.get(o.userId), o.scheduledDate),
      }
    })
  }

  /** Colunas selecionadas para montar uma LedgerRow de Cestinha. */
  private get _marketLedgerSelect() {
    return {
      id: true,
      userId: true,
      condominiumId: true,
      slotId: true,
      status: true,
      breadQty: true,
      scheduledDate: true,
      separatedAt: true,
      deliveredAt: true,
      failedAt: true,
      failureReason: true,
      cancelReason: true,
      paymentId: true,
      courierId: true,
      creditsAppliedMilli: true,
      moneyAmount: true,
      totalValue: true,
      items: { select: { name: true, qty: true } },
    } as const
  }

  /** Colunas selecionadas para montar uma LedgerRow. */
  private get _ledgerSelect() {
    return {
      id: true,
      userId: true,
      quantity: true,
      slotId: true,
      type: true,
      status: true,
      condominiumId: true,
      courierId: true,
      scheduledDate: true,
      separatedAt: true,
      deliveredAt: true,
      failedAt: true,
      failureReason: true,
      cancelReason: true,
      deliveryNote: true,
      paymentId: true,
    } as const
  }

  /**
   * getLedger — verificação geral de pedidos (futuros + histórico) com filtros.
   * Garante que nenhum pedido fique invisível: lista todos por data/status/condomínio/
   * entregador/busca, paginado.
   */
  async getLedger(filters: LedgerFilters): Promise<{ rows: LedgerRow[]; total: number; hasMore: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (filters.from || filters.to) {
      where.scheduledDate = {}
      if (filters.from) where.scheduledDate.gte = new Date(filters.from)
      if (filters.to) where.scheduledDate.lte = new Date(filters.to)
    }
    if (filters.condominiumId) where.condominiumId = filters.condominiumId
    if (filters.courierId) where.courierId = filters.courierId

    if (filters.q && filters.q.trim()) {
      const q = filters.q.trim()
      const matched = await this.prisma.user.findMany({
        where: {
          OR: [{ name: { contains: q, mode: 'insensitive' } }, { apartment: { contains: q, mode: 'insensitive' } }],
        },
        select: { id: true },
      })
      const ids = matched.map((m) => m.id)
      if (ids.length === 0) return { rows: [], total: 0, hasMore: false }
      where.userId = { in: ids }
    }

    // O filtro de status é por coleção: `MarketOrderStatus` tem `PENDING_PAYMENT`, que não existe
    // em `OrderStatus`. Passar um valor inválido no `in` faria o Prisma estourar, então cada
    // coleção só recebe os status que ela conhece.
    const requested = filters.status ?? []
    const breadStatuses = requested.filter((s) => (BREAD_STATUSES as readonly string[]).includes(s))
    const marketStatuses = requested.filter((s) => (MARKET_STATUSES as readonly string[]).includes(s))
    const breadWhere = { ...where, ...(breadStatuses.length ? { status: { in: breadStatuses as OrderStatus[] } } : {}) }
    const marketWhere = { ...where, ...(marketStatuses.length ? { status: { in: marketStatuses as MarketOrderStatus[] } } : {}) }

    // Um filtro de status que não casa com NENHUM status da coleção significa "nada desta coleção"
    // (ex.: status=PENDING_PAYMENT não deve trazer pedido de pão nenhum).
    const wantBread = filters.kind !== 'CESTINHA' && (requested.length === 0 || breadStatuses.length > 0)
    const wantMarket = filters.kind !== 'BREAD' && (requested.length === 0 || marketStatuses.length > 0)

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
    const skip = Math.max(filters.skip ?? 0, 0)

    // PAGINAÇÃO ENTRE DUAS COLEÇÕES (D-4). `take: limit, skip` por coleção daria uma página
    // errada: as `limit` linhas mais recentes do conjunto unido podem vir todas de uma coleção só.
    // Buscamos `skip + limit` de CADA lado (o teto do que a página pode consumir de uma coleção),
    // unimos, ordenamos e cortamos a janela. O `total` vem dos dois `count`, então é exato.
    const window = skip + limit
    const [orders, breadTotal, marketOrders, marketTotal] = await Promise.all([
      wantBread
        ? this.prisma.order.findMany({
            where: breadWhere,
            orderBy: { scheduledDate: 'desc' },
            take: window,
            select: this._ledgerSelect,
          })
        : Promise.resolve([]),
      wantBread ? this.prisma.order.count({ where: breadWhere }) : Promise.resolve(0),
      wantMarket
        ? this.prisma.marketOrder.findMany({
            where: marketWhere,
            orderBy: { scheduledDate: 'desc' },
            take: window,
            select: this._marketLedgerSelect,
          })
        : Promise.resolve([]),
      wantMarket ? this.prisma.marketOrder.count({ where: marketWhere }) : Promise.resolve(0),
    ])

    const [breadRows, marketRows] = await Promise.all([
      this._enrichOrders(orders),
      this._enrichMarketOrders(marketOrders),
    ])

    const merged = [...breadRows, ...marketRows].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
    const total = breadTotal + marketTotal
    const rows = merged.slice(skip, skip + limit)
    return { rows, total, hasMore: skip + rows.length < total }
  }

  /**
   * getStuck — pedidos "no limbo": data de entrega já passou e ainda não tiveram
   * desfecho (não entregue, não cancelado). Base do alerta no Painel e do filtro Parados.
   */
  async getStuck(): Promise<{ rows: LedgerRow[]; count: number }> {
    const now = new Date()
    const nowBrtString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const [day, month, year] = nowBrtString.split('/')
    const startOfTodayBrt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0, 0))

    const where = {
      scheduledDate: { lt: startOfTodayBrt },
      status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] as OrderStatus[] },
    }
    // Cestinha parada: mesma regra (data passada, sem desfecho). `PENDING_PAYMENT` fica de FORA —
    // esse caso já tem dono (o sweep do cron libera estoque e crédito) e apareceria como falso
    // positivo aqui. O que a tela precisa pegar é a Cestinha que ninguém entregou nem fechou.
    const marketWhere = {
      scheduledDate: { lt: startOfTodayBrt },
      status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] as MarketOrderStatus[] },
    }

    const [orders, count, marketOrders, marketCount] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { scheduledDate: 'asc' },
        take: 200,
        select: this._ledgerSelect,
      }),
      this.prisma.order.count({ where }),
      this.prisma.marketOrder.findMany({
        where: marketWhere,
        orderBy: { scheduledDate: 'asc' },
        take: 200,
        select: this._marketLedgerSelect,
      }),
      this.prisma.marketOrder.count({ where: marketWhere }),
    ])

    const [breadRows, marketRows] = await Promise.all([
      this._enrichOrders(orders),
      this._enrichMarketOrders(marketOrders),
    ])
    // Mais antigo primeiro — o pedido esquecido há mais tempo é o mais urgente.
    const rows = [...breadRows, ...marketRows].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    return { rows, count: count + marketCount }
  }

  /**
   * getOrderDetail — um pedido (pão ou Cestinha) com TUDO que o admin precisa para responder
   * "o que aconteceu com este pedido e como ele foi pago".
   *
   * Reusa `_enrich*` de propósito: o detalhe e a linha da lista têm de contar a mesma história.
   * O que se acrescenta é o que não cabe numa lista — o pagamento inteiro (método, gateway,
   * combo), os créditos movimentados e quando o pedido nasceu.
   *
   * `kind` é uma dica, não uma exigência: sem ele tentamos `Order` e caímos em `MarketOrder`.
   * A tela de Clientes tem o `kind` na mão; um link colado no navegador não tem.
   */
  async getOrderDetail(id: string, kind?: 'BREAD' | 'CESTINHA'): Promise<OrderDetail> {
    const order =
      kind === 'CESTINHA'
        ? null
        : await this.prisma.order.findUnique({
            where: { id },
            select: { ...this._ledgerSelect, createdAt: true, failureCode: true, correctedAt: true, correctedById: true, correctionNote: true },
          })

    if (order) {
      const [row] = await this._enrichOrders([order])
      // Débito do pedido de pão. O avulso sempre amarrou a transação ao pedido; o corte da agenda
      // só passou a amarrar depois — em pedido antigo não há linha, e aí o valor é DERIVADO da
      // quantidade (1 pão = 1 crédito na criação). Derivar é honesto: é exatamente a regra que
      // debitou. Ver o comentário no corte, em schedules.service.ts.
      const [debit, refund, payment, proof] = await Promise.all([
        this.prisma.creditTransaction.findFirst({
          where: { type: TransactionType.DELIVERY, referenceId: id },
          select: { quantityMilli: true },
        }),
        this.prisma.creditTransaction.findMany({
          where: { type: TransactionType.REFUND, referenceId: id },
          select: { quantityMilli: true },
        }),
        this._loadPayment(order.paymentId),
        this._loadProof({ orderId: id }),
      ])

      return {
        ...row,
        createdAt: order.createdAt.toISOString(),
        code: shortOrderCode(id),
        creditsDebited: debit ? Math.abs(fromMilli(debit.quantityMilli ?? 0)) : order.quantity,
        creditsDebitedDerived: !debit,
        refundedCredits: sumMilliAbs(refund),
        payment,
        failureCode: order.failureCode ?? null,
        proof,
        issues: await this._loadIssues(id, proof),
        correction: await this._correctionOf(order),
      }
    }

    const marketOrder =
      kind === 'BREAD'
        ? null
        : await this.prisma.marketOrder.findUnique({
            where: { id },
            select: { ...this._marketLedgerSelect, createdAt: true, failureCode: true, correctedAt: true, correctedById: true, correctionNote: true },
          })

    if (!marketOrder) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const [row] = await this._enrichMarketOrders([marketOrder])
    const [refund, payment, proof] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { type: TransactionType.MARKET_REFUND, referenceId: id },
        select: { quantityMilli: true },
      }),
      this._loadPayment(marketOrder.paymentId),
      this._loadProof({ marketOrderId: id }),
    ])

    return {
      ...row,
      createdAt: marketOrder.createdAt.toISOString(),
      code: shortOrderCode(id),
      // Na Cestinha o débito é o split — já veio do pedido, não precisa de derivação.
      creditsDebited: row.creditsApplied,
      creditsDebitedDerived: false,
      refundedCredits: sumMilliAbs(refund),
      payment,
      failureCode: marketOrder.failureCode ?? null,
      proof,
      issues: await this._loadIssues(id, proof),
      correction: await this._correctionOf(marketOrder),
    }
  }

  /** Problemas reportados na parada: pelo id do pedido e pelos da parada no comprovante. */
  private async _loadIssues(id: string, proof: ProofDetail | null): Promise<IssueDetail[]> {
    const ids = [...new Set([id, ...(proof?.stopIds ?? [])])]
    const rows = await this.prisma.courierReport.findMany({
      where: { kind: 'STOP_ISSUE', OR: [{ orderId: { in: ids } }, { marketOrderId: { in: ids } }] },
      orderBy: { createdAt: 'desc' },
    })
    if (rows.length === 0) return []
    const couriers = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.courierId))] } }, select: { id: true, name: true } })
    const nameOf = new Map(couriers.map((c) => [c.id, c.name]))
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      label: STOP_ISSUE_LABELS[r.type as StopIssueType] ?? r.type,
      text: r.text ?? null,
      createdAt: r.createdAt.toISOString(),
      courierName: nameOf.get(r.courierId) ?? null,
      status: r.status,
      resolution: r.resolution ?? null,
    }))
  }

  private async _correctionOf(o: { correctedAt?: Date | null; correctedById?: string | null; correctionNote?: string | null }) {
    if (!o.correctedAt) return null
    const by = o.correctedById ? await this.prisma.user.findUnique({ where: { id: o.correctedById }, select: { name: true } }) : null
    return { at: o.correctedAt.toISOString(), byName: by?.name ?? null, note: o.correctionNote ?? null }
  }

  /**
   * H-2 · "Marcar não entregue": corrige uma entrega reportada de ENTREGUE para NÃO ENTREGUE, na
   * parada inteira (pão + Cestinhas do mesmo cliente/turno/dia/entregador). SÓ corrige o status:
   * sem push ao cliente, sem mexer em pãezins e sem desfazer o Indique e Ganhe — o admin trata o
   * resto por fora. Fica fora do `VALID_TRANSITIONS` de propósito. Fecha os reportes da parada como
   * `CORRECTED`. @throws 404 · 409 não está entregue
   */
  async correctNotDelivered(id: string, adminId: string, note: string | null, now: Date = new Date()): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true, userId: true, courierId: true, slotId: true, scheduledDate: true, status: true } })
    const market = order ? null : await this.prisma.marketOrder.findUnique({ where: { id }, select: { id: true, userId: true, courierId: true, slotId: true, scheduledDate: true, status: true } })
    const base = order ?? market
    if (!base) throw { statusCode: 404, message: 'Pedido não encontrado' }
    if (base.status !== 'DELIVERED') throw { statusCode: 409, message: 'Só dá para corrigir uma entrega marcada como entregue' }
    const { start, end } = brtDayRange(base.scheduledDate)
    const scope = { userId: base.userId, courierId: base.courierId ?? undefined, slotId: base.slotId ?? undefined, scheduledDate: { gte: start, lte: end }, status: 'DELIVERED' as const }
    const [breads, markets] = await Promise.all([
      this.prisma.order.findMany({ where: scope, select: { id: true } }),
      this.prisma.marketOrder.findMany({ where: scope, select: { id: true } }),
    ])
    const data = { failedAt: now, failureCode: CORRECTED_BY_ADMIN_CODE, correctedAt: now, correctedById: adminId, correctionNote: note?.trim() || null }
    if (breads.length) await this.prisma.order.updateMany({ where: { id: { in: breads.map((b) => b.id) }, status: 'DELIVERED' }, data: { ...data, status: 'NOT_DELIVERED' } })
    if (markets.length) await this.prisma.marketOrder.updateMany({ where: { id: { in: markets.map((m) => m.id) }, status: 'DELIVERED' }, data: { ...data, status: 'NOT_DELIVERED' } })
    const ids = [...breads.map((b) => b.id), ...markets.map((m) => m.id)]
    await this.prisma.courierReport.updateMany({
      where: { kind: 'STOP_ISSUE', status: 'OPEN', OR: [{ orderId: { in: ids } }, { marketOrderId: { in: ids } }] },
      data: { status: 'RESOLVED', resolution: 'CORRECTED', resolvedAt: now, resolvedById: adminId },
    })
    return this.getOrderDetail(id, order ? 'BREAD' : 'CESTINHA')
  }

  /**
   * Comprovante da parada do pedido (A1). A foto só vai como URL ASSINADA (T-4), e só enquanto
   * está dentro dos 90 dias. Falha ao assinar (S3 fora) não derruba o detalhe: vai sem a URL.
   */
  private async _loadProof(ref: { orderId?: string; marketOrderId?: string }): Promise<ProofDetail | null> {
    const proof = await this.prisma.deliveryProof.findFirst({
      where: ref.orderId ? { orderId: ref.orderId } : { marketOrderIds: { has: ref.marketOrderId! } },
      orderBy: { updatedAt: 'desc' },
    })
    if (!proof) return null
    const expired = !!proof.photoAt && isProofExpired(proof.photoAt)
    let photoUrl: string | null = null
    if (proof.status === 'OK' && proof.photoKey && !expired && isStorageConfigured()) {
      try {
        photoUrl = await getSignedReadUrl(proof.photoKey)
      } catch (err) {
        this.fastify.log.warn({ err, proofId: proof.id }, '[admin-orders] falha ao assinar a foto do comprovante')
      }
    }
    return {
      status: proof.status,
      outcome: proof.outcome,
      required: proof.required,
      photoUrl,
      photoAt: proof.photoAt ? proof.photoAt.toISOString() : null,
      note: proof.note ?? null,
      confirmedVia: proof.confirmedVia ?? null,
      expired,
      clientVisible: (await getRouteConfig(this.prisma)).fotoClienteVisivel,
      stopIds: [proof.orderId, ...(proof.marketOrderIds ?? [])].filter((x): x is string => !!x),
    }
  }

  /** Pagamento vinculado, com o nome do combo resolvido. `null` quando pago só com saldo. */
  private async _loadPayment(paymentId: string | null): Promise<OrderPayment | null> {
    if (!paymentId) return null
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!p) return null

    const combo = p.comboId
      ? await this.prisma.combo.findUnique({ where: { id: p.comboId }, select: { name: true, quantity: true } })
      : null

    return {
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      // Ausente/null = CREDITS (compra de créditos) — ver o enum no schema.
      purpose: p.purpose ?? 'CREDITS',
      createdAt: p.createdAt.toISOString(),
      // Um campo só: a tela não se importa com QUAL gateway, só quer o id para conciliar.
      gatewayId: p.stripePaymentIntentId ?? p.mercadoPagoId ?? '',
      comboName: combo?.name ?? '',
      quantity: combo?.quantity ?? p.customQuantity ?? 0,
    }
  }

  /**
   * refundOrder — estorna os créditos de um pedido (atalho do detalhe do pedido).
   * Cria CreditTransaction REFUND + incrementa o saldo. Idempotente: bloqueia 2º estorno.
   */
  async refundOrder(orderId: string, adminId: string, reason?: string): Promise<{ id: string; refundedCredits: number; creditBalance: number }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const existing = await this.prisma.creditTransaction.findFirst({
      where: { type: 'REFUND', referenceId: orderId },
      select: { id: true },
    })
    if (existing) {
      throw { statusCode: 409, message: 'Este pedido já foi estornado' }
    }

    await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          userId: order.userId,
          type: 'REFUND',
          quantityMilli: toMilli(order.quantity),
          referenceId: orderId,
          description: `Estorno de pedido — ${order.quantity} ${order.quantity === 1 ? 'pãozin' : 'pãezins'} devolvidos`,
          adminId,
          reason,
        },
      }),
      this.prisma.user.update({
        where: { id: order.userId },
        data: { creditMilli: { increment: toMilli(order.quantity) } },
      }),
    ])

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { creditMilli: true },
    })
    return {
      id: orderId,
      refundedCredits: order.quantity,
      creditBalance: fromMilli((user?.creditMilli ?? 0)),
    }
  }

  /**
   * resolveStuckOrder — dá o desfecho a um pedido "parado" (data passada sem
   * conclusão) em UMA transação: aplica o status terminal escolhido e, opcionalmente,
   * devolve os pães ao saldo no mesmo passo.
   *
   * Diferenças em relação a updateOrderStatus + refundOrder (que este método reusa a
   * lógica, sem aninhar transações):
   * - Aceita ir direto de SCHEDULED para DELIVERED/NOT_DELIVERED (ver VALID_TRANSITIONS).
   * - Agrega o estorno de pães (só faz sentido em NOT_DELIVERED/CANCELLED — DELIVERED
   *   consumiu o crédito corretamente). Idempotente por referenceId.
   * - Não dispara push retroativo: só notifica DELIVERED se a data do pedido for hoje
   *   (um parado é sempre passado, então na prática nunca notifica).
   *
   * Estorno de DINHEIRO (Stripe) NÃO acontece aqui — permanece no fluxo de Pagamentos
   * (POST /admin/payments/:id/refund), pois dinheiro pago ≠ pães do pedido.
   *
   * @throws { statusCode: 404 } pedido não encontrado
   * @throws { statusCode: 422 } transição inválida (ex.: pedido já terminal)
   */
  async resolveStuckOrder(
    orderId: string,
    adminId: string,
    opts: { outcome: 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED'; reason?: string; refundCredits?: boolean },
  ): Promise<{ id: string; status: string; refundedCredits: number; creditBalance: number }> {
    const { outcome, reason } = opts
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const allowed = VALID_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(outcome)) {
      throw { statusCode: 422, message: `Transição inválida: ${order.status} → ${outcome}` }
    }

    // Só devolve pães em não-entrega/cancelamento — entrega consumiu o crédito.
    const wantsRefund = !!opts.refundCredits && (outcome === 'NOT_DELIVERED' || outcome === 'CANCELLED')
    // Idempotência: não estorna duas vezes o mesmo pedido.
    const alreadyRefunded = wantsRefund
      ? await this.prisma.creditTransaction.findFirst({
          where: { type: 'REFUND', referenceId: orderId },
          select: { id: true },
        })
      : null
    const doRefund = wantsRefund && !alreadyRefunded

    const now = new Date()
    const orderData: Prisma.OrderUpdateInput = { status: outcome as OrderStatus }
    switch (outcome) {
      case 'DELIVERED':
        orderData.deliveredAt = now
        orderData.deliveryNote = reason ?? null
        break
      case 'NOT_DELIVERED':
        orderData.failedAt = now
        orderData.failureReason = reason ?? null
        break
      case 'CANCELLED':
        orderData.cancelledAt = now
        orderData.cancelReason = reason ?? null
        break
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.order.update({ where: { id: orderId }, data: orderData }),
    ]
    if (doRefund) {
      ops.push(
        this.prisma.creditTransaction.create({
          data: {
            userId: order.userId,
            type: 'REFUND',
            quantityMilli: toMilli(order.quantity),
            referenceId: orderId,
            description: `Estorno de pedido — ${order.quantity} ${order.quantity === 1 ? 'pãozin' : 'pãezins'} devolvidos`,
            adminId,
            reason,
          },
        }),
        this.prisma.user.update({
          where: { id: order.userId },
          data: { creditMilli: { increment: toMilli(order.quantity) } },
        }),
      )
    }
    await this.prisma.$transaction(ops)

    // Push só para entrega no mesmo dia — nunca retroativo.
    if (outcome === 'DELIVERED' && brtDateStr(order.scheduledDate) === brtDateStr(now)) {
      await this.notifyAndPersist(order)
    }
    // Indique e Ganhe — entrega confirmada depois, mas é entrega: pode qualificar. Nunca lança.
    if (outcome === 'DELIVERED') await afterDelivery(this.fastify, order.userId)

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { creditMilli: true },
    })
    return {
      id: orderId,
      status: outcome,
      refundedCredits: doRefund ? order.quantity : 0,
      creditBalance: fromMilli((user?.creditMilli ?? 0)),
    }
  }

  /**
   * resolveStuckMarketOrder — dá o desfecho a uma CESTINHA "parada" (data passada sem conclusão).
   * Espelha `resolveStuckOrder` do pão, reusando `lib/market-reversal.ts`.
   *
   * Antes disto não havia NENHUM caminho para reverter uma Cestinha depois do corte: o cliente é
   * barrado por `CUTOFF_PASSED` e o estorno genérico de `purpose=MARKET` está bloqueado em
   * admin-payments ("use o cancelamento da Cestinha"). Era um beco sem saída.
   *
   * `returnStock` default: `true` só em CANCELLED — o pedido nunca saiu da prateleira. Em
   * NOT_DELIVERED o produto já foi retirado e pode ter se perdido no caminho, então devolver
   * estoque automaticamente inflaria o inventário; o admin decide explicitamente.
   *
   * Estorno em DINHEIRO no gateway NÃO acontece aqui (DEC-36) — a devolução é toda em pãezinhos.
   *
   * @throws { statusCode: 404 } Cestinha não encontrada
   * @throws { statusCode: 422 } pedido já em estado terminal
   */
  async resolveStuckMarketOrder(
    marketOrderId: string,
    adminId: string,
    opts: {
      outcome: 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED'
      reason?: string
      refundCredits?: boolean
      returnStock?: boolean
    },
  ): Promise<{ id: string; status: string; refundedCredits: number; creditBalance: number }> {
    const order = await this.prisma.marketOrder.findUnique({ where: { id: marketOrderId } })
    if (!order) {
      throw { statusCode: 404, message: 'Cestinha não encontrada' }
    }
    if (['DELIVERED', 'NOT_DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw { statusCode: 422, message: `Esta Cestinha já está em ${order.status}` }
    }

    // Entrega consumiu os produtos e o crédito corretamente — não devolve nada.
    const wantsRefund = !!opts.refundCredits && opts.outcome !== 'DELIVERED'
    const returnStock = opts.returnStock ?? (opts.outcome === 'CANCELLED')

    const avulsoRow = await this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
    const avulsoUnit = avulsoRow ? Number(avulsoRow.value) : 0

    const refundedCredits = await reverseMarketOrder(this.prisma, order, {
      status: opts.outcome,
      reason: opts.reason,
      refundCredits: wantsRefund,
      returnStock: opts.outcome === 'DELIVERED' ? false : returnStock,
      avulsoUnit: Number.isFinite(avulsoUnit) ? avulsoUnit : 0,
      adminId,
      description: `Resolução de Cestinha parada (${opts.outcome})`,
    })

    // Onda F — o desfecho de um pedido parado é sempre notícia para quem pagou, e este método é a
    // única saída de uma Cestinha travada. O guard de estado terminal acima garante um aviso só.
    if (opts.outcome === 'DELIVERED') {
      // Mesma regra do pão (`resolveStuckOrder`): "sua Cestinha chegou" só no dia da entrega.
      // Fechar a papelada de um pedido de três dias atrás não é aviso, é confusão.
      if (brtDateStr(order.scheduledDate) === brtDateStr(new Date())) {
        await notifyMarketDelivered(this.fastify, order.userId)
      }
      // Indique e Ganhe — Cestinha entregue também qualifica (D-1). Nunca lança.
      await afterDelivery(this.fastify, order.userId)
    } else if (opts.outcome === 'NOT_DELIVERED') {
      await notifyMarketNotDelivered(this.fastify, order, { reason: opts.reason, refundedCredits })
    } else {
      await notifyMarketCancelled(this.fastify, order, { cause: 'ADMIN', reason: opts.reason, refundedCredits })
    }

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { creditMilli: true },
    })
    return {
      id: marketOrderId,
      status: opts.outcome,
      refundedCredits,
      creditBalance: fromMilli((user?.creditMilli ?? 0)),
    }
  }

  /**
   * Cria uma Notification e aplica trim de 30 por usuário.
   *
   * T-05-03: Máximo 30 notificações por userId — deleteMany com ids da fatia [30:].
   */
  async createAndTrim(data: {
    userId: string
    type: NotificationType
    title: string
    body: string
    actionRoute?: string
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        actionRoute: data.actionRoute,
        isRead: false,
      },
    })

    // Trim — D-10: máximo 30 notificações por usuário
    const all = await this.prisma.notification.findMany({
      where: { userId: data.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (all.length > 30) {
      const toDelete = all.slice(30).map((n: { id: string }) => n.id)
      await this.prisma.notification.deleteMany({
        where: { id: { in: toDelete } },
      })
    }
  }
}
