import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { formatCredits, fromMilli } from '@cheirin-de-pao/shared'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@cheirin-de-pao/shared'
import { AdminMarketRepository } from './admin-market.repository.js'
import type { SetStockBody, MarketOrderFilters } from './admin-market.schema.js'
import { brtDateStr, brtDayRange, brtNoonFromStr } from '../../lib/cutoff.js'
import { refundableCreditsMilli, reverseMarketOrder } from '../../lib/market-reversal.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'
import { LOW_STOCK_THRESHOLD } from '../../lib/market-stock-alerts.js'
import { loadUnitCosts, productMargin } from '../../lib/product-cost.js'
import { notifyMarketCancelled, notifyMarketLossResolved } from '../market/market-notify.js'

/** Uma Cestinha na visão do admin — itens com preço, split, pagamento e marcos do ciclo. */
export interface AdminMarketOrderRow {
  id: string
  userId: string
  clientName: string
  clientPhone: string
  block: string
  /** Complemento do bloco ("Lado A"); '' quando não há. */
  complement: string
  apartment: string
  condominiumId: string
  condominiumName: string
  slotId: string
  slotLabel: string
  deliveryTime: string
  status: string
  scheduledDate: string
  /** Pães vendidos dentro da Cestinha (D-1: é pão, conta nos contadores de pão da operação). */
  breadQty: number
  items: { productId: string; name: string; qty: number; unitPrice: number }[]
  itemCount: number
  totalValue: number
  creditsApplied: number
  moneyAmount: number
  courierId: string
  courierName: string
  paymentId: string
  paymentStatus: string
  paymentMethod: string
  separatedAt: string
  deliveredAt: string
  failedAt: string
  failureReason: string
  cancelledAt: string
  cancelReason: string
  createdAt: string
  /** Pãezinhos já devolvidos (soma das MARKET_REFUND deste pedido). */
  refundedCredits: number
  cancelable: boolean
  // ── Desfecho físico de uma entrega que falhou (Onda G2) ──
  lossResolvedAt: string
  /** `null` enquanto não resolvida; depois: true = voltou à prateleira, false = perda real. */
  stockReturned: boolean | null
  lossReason: string
  /** true quando é NOT_DELIVERED e ninguém deu o desfecho ainda — pendência de verdade. */
  lossPending: boolean
}

// O limiar de "estoque baixo" vive em `lib/market-stock-alerts.ts` — a flag desta listagem e a
// notificação ao admin (F5) têm de concordar, senão a tela mostra "Baixo" sem ninguém ser avisado.
const MIN_CESTINHA_KEY = 'marketMinimoCestinha'
const DEFAULT_MIN_CESTINHA = 15
const CARTAO_MIN_KEY = 'marketCartaoMinimo'
const DEFAULT_CARTAO_MIN = 0
const BREAD_PRODUCT_KEY = 'breadProductId'

type ProductRow = Awaited<ReturnType<AdminMarketRepository['findProduct']>>

/**
 * AdminMarketService — CRUD de produtos/categorias, ajuste de estoque e config do mini market.
 * Erros de negócio via `throw { statusCode, message }` (padrão da casa).
 */
export class AdminMarketService {
  private repo: AdminMarketRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new AdminMarketRepository(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  private isLowStock(p: { stockType: string; stock: number | null }): boolean {
    return p.stockType === 'FIXED' && p.stock != null && p.stock <= LOW_STOCK_THRESHOLD
  }

  private withFlags<T extends { stockType: string; stock: number | null }>(p: T) {
    return { ...p, lowStock: this.isLowStock(p) }
  }

  /** Id do produto FIXO "Pão Francês" (marcado por Setting) — ou null se ainda não semeado. */
  private async getBreadProductId(): Promise<string | null> {
    const s = await this.repo.getSetting(BREAD_PRODUCT_KEY)
    return s?.value ?? null
  }

  // ── Produtos ──
  /**
   * H9 — cada produto sai com o custo esperado (matriz de fornecimento, D-8) e a margem.
   *
   * É a informação que faltava exatamente onde o preço é definido: sem ela, o admin precificava no
   * escuro. Produto sem fornecedor cadastrado vem com `unitCost: null` e `margin: null` — a tela
   * diz "sem custo", nunca "100% de margem".
   */
  private async withCost<T extends { id: string; price: number }>(products: T[]) {
    const costs = await loadUnitCosts(this.prisma, products.map((p) => p.id))
    return products.map((p) => {
      const cost = costs.get(p.id)
      const m = productMargin(p.price, cost?.unitCost)
      return {
        ...p,
        unitCost: cost?.unitCost ?? null,
        costBasis: cost?.basis ?? null,
        costSuppliers: cost?.suppliers ?? 0,
        margin: m?.margin ?? null,
        marginPct: m?.marginPct ?? null,
      }
    })
  }

  async listProducts() {
    const [products, breadId] = await Promise.all([this.repo.listProducts(), this.getBreadProductId()])
    return this.withCost(products.map((p) => ({ ...this.withFlags(p), isBread: p.id === breadId })))
  }

  async getProduct(id: string) {
    const [p, breadId] = await Promise.all([this.repo.findProduct(id), this.getBreadProductId()])
    if (!p) throw { statusCode: 404, message: 'Produto não encontrado' }
    return (await this.withCost([{ ...this.withFlags(p), isBread: p.id === breadId }]))[0]
  }

  async createProduct(input: CreateProductInput) {
    const cat = await this.repo.findCategory(input.categoryId)
    if (!cat) throw { statusCode: 400, message: 'Categoria inválida' }

    const data: Prisma.ProductUncheckedCreateInput = {
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price,
      photoUrl: input.photoUrl,
      stockType: input.stockType,
      stock: input.stockType === 'FIXED' ? (input.stock ?? 0) : null,
      dailyCapacity: input.stockType === 'DAILY' ? (input.dailyCapacity ?? 0) : null,
      // [] = sempre disponível (evita JSON-null no Mongo)
      availableDays: (input.availableDays ?? []) as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    }
    return this.repo.createProduct(data)
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    const existing = await this.repo.findProduct(id)
    if (!existing) throw { statusCode: 404, message: 'Produto não encontrado' }

    if (input.categoryId) {
      const cat = await this.repo.findCategory(input.categoryId)
      if (!cat) throw { statusCode: 400, message: 'Categoria inválida' }
    }

    // Pão Francês (fixo): só apresentação é editável. Preço vem sempre do avulso (o catálogo
    // sobrescreve), estoque é sempre disponível (DAILY) e o produto permanece ativo.
    const breadId = await this.getBreadProductId()
    if (id === breadId) {
      const breadData: Prisma.ProductUncheckedUpdateInput = {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        photoUrl: input.photoUrl,
        isActive: true,
      }
      if (input.availableDays !== undefined) {
        breadData.availableDays = (input.availableDays ?? []) as Prisma.InputJsonValue
      }
      return this.repo.updateProduct(id, breadData)
    }

    const data: Prisma.ProductUncheckedUpdateInput = {
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price,
      photoUrl: input.photoUrl,
      stockType: input.stockType,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    }

    // Coerência de estoque conforme o tipo resultante (mantém só o campo do tipo atual)
    const nextType = input.stockType ?? existing.stockType
    if (nextType === 'FIXED') {
      const nextStock = input.stock ?? existing.stock
      if (nextStock == null) throw { statusCode: 400, message: 'Estoque fixo exige quantidade em estoque' }
      data.stock = nextStock
      data.dailyCapacity = null
    } else {
      const nextCap = input.dailyCapacity ?? existing.dailyCapacity
      if (nextCap == null) throw { statusCode: 400, message: 'Estoque diário exige capacidade por dia' }
      data.dailyCapacity = nextCap
      data.stock = null
    }

    if (input.availableDays !== undefined) {
      data.availableDays = (input.availableDays ?? []) as Prisma.InputJsonValue
    }

    return this.repo.updateProduct(id, data)
  }

  async removeProduct(id: string) {
    const existing = await this.repo.findProduct(id)
    if (!existing) throw { statusCode: 404, message: 'Produto não encontrado' }
    const breadId = await this.getBreadProductId()
    if (id === breadId) {
      throw { statusCode: 409, message: 'O Pão Francês é um item fixo da Cestinha e não pode ser excluído.' }
    }
    return this.repo.deleteProduct(id)
  }

  /** Ajuste manual de estoque pelo admin (FIXED: stock; DAILY: dailyCapacity). */
  async setStock(id: string, body: SetStockBody) {
    const p = await this.repo.findProduct(id)
    if (!p) throw { statusCode: 404, message: 'Produto não encontrado' }

    const data: Prisma.ProductUncheckedUpdateInput = {}
    if (p.stockType === 'FIXED') {
      if (body.stock == null) throw { statusCode: 400, message: 'Produto de estoque fixo — informe stock.' }
      data.stock = body.stock
    } else {
      if (body.dailyCapacity == null) throw { statusCode: 400, message: 'Produto de estoque diário — informe dailyCapacity.' }
      data.dailyCapacity = body.dailyCapacity
    }
    const updated = await this.repo.updateProduct(id, data)
    return this.withFlags(updated as NonNullable<ProductRow>)
  }

  // ── Categorias ──
  async listCategories() {
    const cats = await this.repo.listCategories()
    return Promise.all(
      cats.map(async (c) => ({ ...c, productCount: await this.repo.countProductsInCategory(c.id) })),
    )
  }

  async createCategory(input: CreateCategoryInput) {
    return this.repo.createCategory({
      name: input.name,
      emoji: input.emoji,
      sortOrder: input.sortOrder ?? 0,
    })
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    const existing = await this.repo.findCategory(id)
    if (!existing) throw { statusCode: 404, message: 'Categoria não encontrada' }
    return this.repo.updateCategory(id, {
      name: input.name,
      emoji: input.emoji,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    })
  }

  async removeCategory(id: string) {
    const existing = await this.repo.findCategory(id)
    if (!existing) throw { statusCode: 404, message: 'Categoria não encontrada' }
    const count = await this.repo.countProductsInCategory(id)
    if (count > 0) {
      throw { statusCode: 409, message: `Categoria tem ${count} produto(s). Mova ou exclua os produtos primeiro.` }
    }
    return this.repo.deleteCategory(id)
  }

  // ── Config ──
  async getConfig(): Promise<{ minimo: number; cartaoMinimo: number }> {
    const [mRow, cRow] = await Promise.all([
      this.repo.getSetting(MIN_CESTINHA_KEY),
      this.repo.getSetting(CARTAO_MIN_KEY),
    ])
    const minimo = mRow ? parseFloat(mRow.value) : DEFAULT_MIN_CESTINHA
    const cartaoMinimo = cRow ? parseFloat(cRow.value) : DEFAULT_CARTAO_MIN
    return {
      minimo: Number.isFinite(minimo) ? minimo : DEFAULT_MIN_CESTINHA,
      cartaoMinimo: Number.isFinite(cartaoMinimo) && cartaoMinimo > 0 ? cartaoMinimo : DEFAULT_CARTAO_MIN,
    }
  }

  async setConfig(minimo: number, cartaoMinimo?: number): Promise<{ minimo: number; cartaoMinimo: number }> {
    await this.repo.upsertSetting(MIN_CESTINHA_KEY, String(minimo))
    if (cartaoMinimo != null) await this.repo.upsertSetting(CARTAO_MIN_KEY, String(cartaoMinimo))
    return this.getConfig()
  }

  // ── Cestinhas (MarketOrder) ─────────────────────────────────────────────────
  //
  // Até aqui o admin não tinha NENHUMA forma de abrir, auditar ou reverter uma Cestinha: o módulo
  // só cuidava de produtos/categorias/config. O ledger unificado (D-4) resolve a verificação geral
  // da operação; estas rotas dão a visão do mercadinho — com itens, split e as ações do admin.

  /** Janela do dia BRT para um YYYY-MM-DD (mesma convenção do resto da operação). */
  private dayRangeOf(dateStr: string): { gte: Date; lte: Date } {
    const { start, end } = brtDayRange(brtNoonFromStr(dateStr))
    return { gte: start, lte: end }
  }

  async listOrders(filters: MarketOrderFilters): Promise<{
    rows: AdminMarketOrderRow[]
    total: number
    hasMore: boolean
  }> {
    const where: Prisma.MarketOrderWhereInput = {}
    if (filters.from || filters.to) {
      const range: { gte?: Date; lte?: Date } = {}
      if (filters.from) range.gte = this.dayRangeOf(filters.from).gte
      if (filters.to) range.lte = this.dayRangeOf(filters.to).lte
      where.scheduledDate = range
    }
    if (filters.status?.length) where.status = { in: filters.status }
    if (filters.condominiumId) where.condominiumId = filters.condominiumId

    if (filters.q?.trim()) {
      const q = filters.q.trim()
      const matched = await this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { apartment: { contains: q, mode: 'insensitive' } },
            { complement: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      })
      const ids = matched.map((m) => m.id)
      if (ids.length === 0) return { rows: [], total: 0, hasMore: false }
      where.userId = { in: ids }
    }

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
    const skip = Math.max(filters.skip ?? 0, 0)

    const [orders, total] = await Promise.all([
      this.repo.listMarketOrders(where, limit, skip),
      this.repo.countMarketOrders(where),
    ])

    const rows = await this.enrichOrders(orders)
    return { rows, total, hasMore: skip + orders.length < total }
  }

  async getOrder(id: string): Promise<AdminMarketOrderRow> {
    const order = await this.repo.findMarketOrder(id)
    if (!order) throw { statusCode: 404, message: 'Cestinha não encontrada' }
    const [row] = await this.enrichOrders([order])
    return row
  }

  /**
   * cancelOrderAsAdmin — cancela uma Cestinha SEM o gate de corte do cliente.
   *
   * Fecha o único beco sem saída que sobrou no pós-venda da Cestinha: passado o corte, o cliente é
   * barrado por `CUTOFF_PASSED` e o estorno genérico de `purpose=MARKET` está bloqueado em
   * admin-payments de propósito (estornaria o dinheiro deixando o pedido ativo e os créditos
   * presos). Agora existe um caminho auditável.
   *
   * Estorno tudo em pãezinhos (DEC-36), incluindo a parte paga em dinheiro; sem estorno no gateway.
   * Reusa `lib/market-reversal.ts` — a mesma lógica do cancelamento do cliente.
   */
  async cancelOrderAsAdmin(
    id: string,
    adminId: string,
    opts: { reason?: string; refundCredits?: boolean; returnStock?: boolean } = {},
  ): Promise<{ id: string; status: string; refundedCredits: number; creditBalance: number }> {
    const order = await this.repo.findMarketOrder(id)
    if (!order) throw { statusCode: 404, message: 'Cestinha não encontrada' }
    if (order.status === 'CANCELLED') {
      // Idempotente: cancelar de novo não é erro nem estorna duas vezes.
      const user = await this.prisma.user.findUnique({ where: { id: order.userId }, select: { creditMilli: true } })
      return { id, status: 'CANCELLED', refundedCredits: 0, creditBalance: fromMilli((user?.creditMilli ?? 0)) }
    }
    if (order.status === 'DELIVERED') {
      throw { statusCode: 422, message: 'Esta Cestinha já foi entregue. Use "resolver" em Entregas se precisar reverter.' }
    }

    const avulsoRow = await this.repo.getSetting('avulsoUnit')
    const avulsoUnit = avulsoRow ? Number(avulsoRow.value) : 0

    const refundedCredits = await reverseMarketOrder(this.prisma, order, {
      status: 'CANCELLED',
      reason: opts.reason ?? 'Cancelado pelo admin',
      refundCredits: opts.refundCredits ?? true,
      // Cancelado = não saiu da prateleira → devolve estoque por padrão.
      returnStock: opts.returnStock ?? true,
      avulsoUnit: Number.isFinite(avulsoUnit) ? avulsoUnit : 0,
      adminId,
      description: 'Cancelamento da Cestinha pelo admin',
    })

    // Onda F — o cliente não pediu isso: sem aviso, ele só descobre que o pedido caiu (e que os
    // pãezinhos voltaram) abrindo o app. O guard de idempotência acima garante um aviso só.
    await notifyMarketCancelled(this.fastify, order, {
      cause: 'ADMIN',
      reason: opts.reason,
      refundedCredits,
    })

    const user = await this.prisma.user.findUnique({ where: { id: order.userId }, select: { creditMilli: true } })
    return { id, status: 'CANCELLED', refundedCredits, creditBalance: fromMilli((user?.creditMilli ?? 0)) }
  }

  /**
   * getStockOutlook — o que já está comprometido por produto e por dia (Onda G1).
   *
   * Responde a pergunta operacional que faltava: **quanto preparar/comprar para cada dia**. A
   * Separação (Onda B1) responde "o que pegar da prateleira HOJE"; aqui a janela é para frente.
   *
   * Dois números por (produto, dia), de propósito:
   * - **`confirmed`** — pedidos que existem de verdade (`CONFIRMED_MARKET_STATUSES`). É por este que
   *   se prepara e se compra: `PENDING_PAYMENT` pode morrer no sweep (Onda F1).
   * - **`reserved`** — o contador de capacidade do dia (`ProductDailyStock`), que INCLUI as reservas
   *   aguardando pagamento. É por este que se sabe quantas vagas ainda existem para vender.
   *
   * A diferença entre os dois é informação, não inconsistência: `reserved − confirmed` é exatamente
   * o que está preso em carrinho não pago.
   */
  async getStockOutlook(days = 7): Promise<{
    days: Array<{
      date: string
      products: Array<{
        productId: string
        productName: string
        stockType: string
        /** Unidades de pedidos confirmados — o que preparar. */
        confirmed: number
        /** Contador de capacidade do dia (inclui aguardando pagamento). `null` em produto FIXO. */
        reserved: number | null
        /** Capacidade do dia (`dailyCapacity`). `null` em produto FIXO. */
        capacity: number | null
        /** Vagas restantes no dia (`capacity − reserved`). `null` em produto FIXO. */
        available: number | null
        /** Estoque absoluto atual — só em produto FIXO. */
        stock: number | null
      }>
      totalItems: number
    }>
  }> {
    const span = Math.max(1, Math.min(30, days))
    const today = brtNoonFromStr(brtDateStr(new Date()))
    const start = brtDayRange(today).start
    const lastDay = new Date(today.getTime() + (span - 1) * 24 * 60 * 60 * 1000)
    const end = brtDayRange(lastDay).end

    const [orders, products, dailyStocks] = await Promise.all([
      this.prisma.marketOrder.findMany({
        where: {
          scheduledDate: { gte: start, lte: end },
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
        },
        select: { scheduledDate: true, items: { select: { productId: true, name: true, qty: true } } },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, stockType: true, stock: true, dailyCapacity: true },
      }),
      this.prisma.productDailyStock.findMany({
        where: { date: { gte: brtDateStr(start), lte: brtDateStr(end) } },
        select: { productId: true, date: true, reserved: true },
      }),
    ])

    const reservedBy = new Map(dailyStocks.map((d) => [`${d.productId}|${d.date}`, d.reserved]))

    // Confirmado por (dia, produto).
    const confirmedBy = new Map<string, number>()
    for (const o of orders) {
      const dateStr = brtDateStr(o.scheduledDate)
      for (const it of o.items) confirmedBy.set(`${dateStr}|${it.productId}`, (confirmedBy.get(`${dateStr}|${it.productId}`) ?? 0) + it.qty)
    }

    const out = []
    for (let i = 0; i < span; i++) {
      const dateStr = brtDateStr(new Date(today.getTime() + i * 24 * 60 * 60 * 1000))
      const rows = []
      for (const p of products) {
        const confirmed = confirmedBy.get(`${dateStr}|${p.id}`) ?? 0
        const reserved = p.stockType === 'FIXED' ? null : reservedBy.get(`${p.id}|${dateStr}`) ?? 0
        const capacity = p.stockType === 'FIXED' ? null : p.dailyCapacity ?? 0
        // Só mostra o que tem movimento (ou o que está esgotado no dia): a lista completa de
        // produtos em 7 dias seria ruído.
        const semVaga = capacity != null && capacity > 0 && (reserved ?? 0) >= capacity
        if (confirmed === 0 && (reserved ?? 0) === 0 && !semVaga) continue
        rows.push({
          productId: p.id,
          productName: p.name,
          stockType: p.stockType,
          confirmed,
          reserved,
          capacity,
          available: capacity != null ? Math.max(0, capacity - (reserved ?? 0)) : null,
          stock: p.stockType === 'FIXED' ? p.stock ?? 0 : null,
        })
      }
      rows.sort((a, b) => b.confirmed - a.confirmed || a.productName.localeCompare(b.productName, 'pt-BR'))
      out.push({ date: dateStr, products: rows, totalItems: rows.reduce((s, r) => s + r.confirmed, 0) })
    }

    return { days: out }
  }

  /**
   * resolveNotDelivered — desfecho FÍSICO de uma Cestinha que não foi entregue (Onda G2).
   *
   * **A política, explicitada.** Quando a entrega falha, nada é devolvido automaticamente, e isso é
   * deliberado:
   * - **Estoque:** o produto saiu da prateleira e foi para a rua. Ele pode ter voltado com o
   *   entregador ou ter se perdido — devolver automático inflaria o inventário com unidades que não
   *   existem mais (é a mesma razão da decisão 4 da Onda B). Só quem recebeu o entregador de volta
   *   sabe, então é escolha explícita.
   * - **Crédito:** estornar automático daria pãezinhos de volta mesmo quando o cliente ficou com a
   *   mercadoria (ex.: entregou ao vizinho). Também é decisão de quem apurou.
   * - **`ProductDailyStock.reserved` NUNCA é liberado.** Ele é a capacidade *daquele dia*, que já
   *   passou: aquelas unidades foram de fato comprometidas. Liberar reescreveria a história de um
   *   dia fechado, sem liberar vaga para ninguém (a chave é produto+data).
   *
   * O que a Onda G2 conserta é o **silêncio**: até aqui uma Cestinha NOT_DELIVERED era terminal,
   * então saía do radar de "parados" (`getStuck` só olha status não-terminais) e o
   * `resolveStuckMarketOrder` a recusava com 422 — não existia NENHUM caminho para devolver o
   * estoque ou o crédito depois que o entregador marcava a falha. O prejuízo ficava invisível.
   *
   * Idempotente por `lossResolvedAt` (o estorno também é, por `referenceId`). **Preserva o status e
   * o motivo originais da falha** — o que o entregador escreveu ("cliente ausente") é o registro do
   * que aconteceu na porta; o desfecho vai em `lossReason`.
   */
  async resolveNotDelivered(
    id: string,
    adminId: string,
    opts: { returnStock: boolean; refundCredits: boolean; reason?: string },
  ): Promise<{
    id: string
    stockReturned: boolean
    refundedCredits: number
    creditBalance: number
    alreadyResolved: boolean
  }> {
    const order = await this.repo.findMarketOrder(id)
    if (!order) throw { statusCode: 404, message: 'Cestinha não encontrada' }
    if (order.status !== 'NOT_DELIVERED') {
      throw {
        statusCode: 422,
        message: 'Só uma Cestinha marcada como NÃO ENTREGUE tem desfecho de perda a resolver.',
      }
    }

    const user0 = await this.prisma.user.findUnique({ where: { id: order.userId }, select: { creditMilli: true } })
    if (order.lossResolvedAt) {
      // Idempotente: devolve o estado atual em vez de estornar/creditar duas vezes.
      return {
        id,
        stockReturned: order.stockReturned ?? false,
        refundedCredits: 0,
        creditBalance: fromMilli((user0?.creditMilli ?? 0)),
        alreadyResolved: true,
      }
    }

    const avulsoRow = await this.repo.getSetting('avulsoUnit')
    const avulsoUnitRaw = avulsoRow ? Number(avulsoRow.value) : 0
    const avulsoUnit = Number.isFinite(avulsoUnitRaw) ? avulsoUnitRaw : 0
    // Canônico em milésimos; o espelho legado é o arredondado (campo `Int` não aceita 1,5).
    const wantedMilli = opts.refundCredits ? refundableCreditsMilli(order, avulsoUnit) : 0
    const wanted = fromMilli(wantedMilli)
    const wantedLegacy = Math.round(wanted)

    // Estorno já existente (ex.: o admin resolveu por outro caminho antes) não credita de novo.
    const existingRefund = await this.prisma.creditTransaction.findFirst({
      where: { type: 'MARKET_REFUND', referenceId: order.id },
      select: { id: true },
    })
    // Gate no MILÉSIMO: um estorno de 0,4 🥖 arredonda para 0 no legado e seria engolido.
    const doRefund = wantedMilli > 0 && !existingRefund
    const dateStr = brtDateStr(order.scheduledDate)

    await this.prisma.$transaction(async (tx) => {
      if (opts.returnStock) {
        for (const it of order.items) {
          const p = await tx.product.findUnique({ where: { id: it.productId } })
          if (!p) continue
          // Só estoque FIXO volta: em DAILY o "reserved" é a capacidade de um dia já encerrado.
          if (p.stockType === 'FIXED') {
            await tx.product.update({ where: { id: p.id }, data: { stock: { increment: it.qty } } })
          }
        }
      }

      if (doRefund) {
        await tx.user.update({
          where: { id: order.userId },
          data: { creditMilli: { increment: wantedMilli } },
        })
        await tx.creditTransaction.create({
          data: {
            userId: order.userId,
            type: 'MARKET_REFUND',
            quantityMilli: wantedMilli,
            referenceId: order.id,
            description: `Cestinha não entregue — ${formatCredits(wantedMilli)} pãezins devolvidos`,
            adminId,
            reason: opts.reason,
          },
        })
      }

      await tx.marketOrder.update({
        where: { id },
        data: {
          lossResolvedAt: new Date(),
          lossResolvedBy: adminId,
          stockReturned: opts.returnStock,
          lossReason: opts.reason ?? null,
          // status, failedAt e failureReason ficam intactos: a entrega falhou e o motivo dela é
          // o que o entregador registrou na porta.
        },
      })
    })

    if (doRefund) {
      await notifyMarketLossResolved(this.fastify, order, { refundedCredits: wanted, reason: opts.reason })
    }

    const user = await this.prisma.user.findUnique({ where: { id: order.userId }, select: { creditMilli: true } })
    return {
      id,
      stockReturned: opts.returnStock,
      refundedCredits: doRefund ? wanted : 0,
      creditBalance: fromMilli((user?.creditMilli ?? 0)),
      alreadyResolved: false,
    }
  }

  /** Enriquece Cestinhas com cliente, condomínio, turno, entregador e estorno já feito. */
  private async enrichOrders(
    orders: Array<{
      id: string
      userId: string
      condominiumId: string
      slotId: string
      deliveryTime: string | null
      status: string
      courierId: string | null
      breadQty: number
      totalValue: number
      creditsApplied: number
      creditsAppliedMilli?: number | null
      moneyAmount: number
      paymentId: string | null
      scheduledDate: Date
      separatedAt: Date | null
      deliveredAt: Date | null
      failedAt: Date | null
      failureReason: string | null
      cancelledAt: Date | null
      cancelReason: string | null
      lossResolvedAt?: Date | null
      stockReturned?: boolean | null
      lossReason?: string | null
      createdAt: Date
      items: { productId: string; name: string; qty: number; unitPrice: number }[]
    }>,
  ): Promise<AdminMarketOrderRow[]> {
    if (orders.length === 0) return []

    const userIds = [...new Set(orders.map((o) => o.userId))]
    const condoIds = [...new Set(orders.map((o) => o.condominiumId))]
    const courierIds = [...new Set(orders.map((o) => o.courierId).filter((c): c is string => !!c))]
    const paymentIds = [...new Set(orders.map((o) => o.paymentId).filter((p): p is string => !!p))]
    const ids = orders.map((o) => o.id)

    const [users, condos, couriers, refunds, payments] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true, complement: true, phone: true },
      }),
      this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true, deliverySlots: true },
      }),
      courierIds.length
        ? this.prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } })
        : Promise.resolve([] as { id: string; name: string }[]),
      this.prisma.creditTransaction.findMany({
        where: { type: 'MARKET_REFUND', referenceId: { in: ids } },
        select: { referenceId: true, quantityMilli: true },
      }),
      paymentIds.length
        ? this.prisma.payment.findMany({
            where: { id: { in: paymentIds } },
            select: { id: true, amount: true, status: true, method: true },
          })
        : Promise.resolve([] as { id: string; amount: number; status: string; method: string }[]),
    ])

    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))
    const courierById = new Map(couriers.map((c) => [c.id, c]))
    // Estorno em pãezinhos decimais (canônico com fallback no legado) — a lista mostra "1,5 🥖".
    const refundByOrder = new Map(
      refunds.map((r) => [r.referenceId ?? '', fromMilli((r.quantityMilli ?? 0))]),
    )
    const paymentById = new Map(payments.map((p) => [p.id, p]))

    return orders.map((o) => {
      const u = userById.get(o.userId)
      const condo = condoById.get(o.condominiumId)
      const slot = condo?.deliverySlots?.find((s) => s.slotId === o.slotId || s.name === o.slotId)
      const payment = o.paymentId ? paymentById.get(o.paymentId) : undefined
      return {
        id: o.id,
        userId: o.userId,
        clientName: u?.name ?? 'Cliente',
        clientPhone: u?.phone ?? '',
        block: u?.block ?? '',
        complement: u?.complement ?? '',
        apartment: u?.apartment ?? '',
        condominiumId: o.condominiumId,
        condominiumName: condo?.name ?? '—',
        slotId: o.slotId,
        slotLabel: slot?.label ?? o.slotId,
        deliveryTime: o.deliveryTime ?? '',
        status: o.status,
        scheduledDate: o.scheduledDate.toISOString(),
        breadQty: o.breadQty,
        items: o.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice })),
        itemCount: o.items.reduce((n, i) => n + i.qty, 0),
        totalValue: o.totalValue,
        // Pãezinhos DECIMAIS — o espelho legado é só arredondamento.
        creditsApplied: fromMilli((o.creditsAppliedMilli ?? 0)),
        moneyAmount: o.moneyAmount,
        courierId: o.courierId ?? '',
        courierName: (o.courierId && courierById.get(o.courierId)?.name) || '',
        paymentId: o.paymentId ?? '',
        paymentStatus: payment?.status ?? '',
        paymentMethod: payment?.method ?? '',
        separatedAt: o.separatedAt?.toISOString() ?? '',
        deliveredAt: o.deliveredAt?.toISOString() ?? '',
        failedAt: o.failedAt?.toISOString() ?? '',
        failureReason: o.failureReason ?? '',
        cancelledAt: o.cancelledAt?.toISOString() ?? '',
        cancelReason: o.cancelReason ?? '',
        createdAt: o.createdAt.toISOString(),
        refundedCredits: refundByOrder.get(o.id) ?? 0,
        // Admin pode cancelar tudo que ainda não foi entregue nem cancelado (sem gate de corte).
        cancelable: !['DELIVERED', 'CANCELLED'].includes(o.status),
        lossResolvedAt: o.lossResolvedAt?.toISOString() ?? '',
        stockReturned: o.stockReturned ?? null,
        lossReason: o.lossReason ?? '',
        // O que faz a perda existir na tela em vez de virar prejuízo silencioso (G2).
        lossPending: o.status === 'NOT_DELIVERED' && !o.lossResolvedAt,
      }
    })
  }
}
