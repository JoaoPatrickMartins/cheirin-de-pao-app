import { FastifyInstance } from 'fastify'
import type { UpdateCartInput } from '@cheirin-de-pao/shared'
import { MARKET_CARTAO_MIN_KEY, parseCartaoMinimo } from '../../lib/market-card-policy.js'
import { MarketRepository } from './market.repository.js'

// Abaixo disso, um produto FIXO exibe "Últimas unidades" no catálogo.
const LOW_STOCK_THRESHOLD = 5
const AVULSO_KEY = 'avulsoUnit'
const MIN_CESTINHA_KEY = 'marketMinimoCestinha'
const DEFAULT_MIN_CESTINHA = 15
const BREAD_PRODUCT_KEY = 'breadProductId'
const PEDIDO_MINIMO_UNICO_KEY = 'pedidoMinimoUnico'

// Linha da Cestinha com snapshot do produto (nome/preço/foto no momento da leitura).
export interface CartLineView {
  productId: string
  qty: number
  name: string
  price: number
  photoUrl: string | null
  categoryId: string
  lineTotal: number
  soldOut: boolean
  /** Teto por pedido (DAILY = capacidade/dia; FIXED = estoque). O front limita o stepper por isso. */
  maxQty: number
  /** Tipo de estoque — só para o rótulo do teto ("máx N/dia" no DAILY). */
  stockType: 'DAILY' | 'FIXED'
}

export interface CartView {
  items: CartLineView[]
  breadQty: number
  /** Σ dos produtos (R$). */
  productSubtotal: number
  /** Total da Cestinha (R$) = produtos + breadQty × avulsoUnit. Base do mínimo. */
  subtotal: number
  /** Σ das quantidades de produto (não inclui pães). */
  count: number
  avulsoUnit: number
  minimo: number
  /** Mínimo em QUANTIDADE de pães (Pão Francês), herdado do pedido único (pedidoMinimoUnico). */
  breadMin: number
  /** Mínimo (R$) da parte em dinheiro para liberar cartão de crédito; 0 = sempre liberado. */
  cartaoMinimo: number
  meetsMinimum: boolean
}

/**
 * MarketService — catálogo do cliente + Cestinha persistente (por usuário).
 * O carrinho guarda apenas { productId, qty } + breadQty; a leitura junta com Product
 * para devolver snapshot de nome/preço/foto e recalcular o subtotal NO SERVIDOR
 * (nunca confiar no cliente). Itens de produto inativo/inexistente são ignorados.
 */
export class MarketService {
  private repo: MarketRepository

  constructor(fastify: FastifyInstance) {
    this.repo = new MarketRepository(fastify)
  }

  async getCatalog() {
    const [products, categories, avulsoUnit, breadRow] = await Promise.all([
      this.repo.listActiveProducts(),
      this.repo.listActiveCategories(),
      this.getAvulsoUnit(),
      this.repo.getSetting(BREAD_PRODUCT_KEY),
    ])
    const breadId = breadRow?.value ?? null

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        sortOrder: c.sortOrder,
      })),
      products: products.map((p) => {
        const isBread = p.id === breadId
        // Teto por pedido: FIXED = estoque atual; DAILY = capacidade por dia. Um único pedido
        // nunca pode passar do teto (independe da data), então o front limita o stepper por ele.
        const maxQty = p.stockType === 'FIXED' ? Math.max(0, p.stock ?? 0) : Math.max(0, p.dailyCapacity ?? 0)
        // Indisponível: FIXED sem inventário OU DAILY sem capacidade (cap <= 0).
        const soldOut = maxQty <= 0
        const limited =
          p.stockType === 'FIXED' && p.stock != null && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          // Pão Francês: preço SEMPRE = avulso (o pão do pedido único), ignora o preço salvo.
          price: isBread ? avulsoUnit : p.price,
          photoUrl: p.photoUrl,
          availableDays: (p.availableDays as string[] | null) ?? [],
          stockType: p.stockType,
          // Pão Francês compra via breadQty (fluxo próprio) → sem teto de stepper (null).
          maxQty: isBread ? null : maxQty,
          soldOut: isBread ? false : soldOut,
          limited: isBread ? false : limited,
          isBread,
        }
      }),
    }
  }

  // ── Precificação (settings) ────────────────────────────────────────────────
  private async getAvulsoUnit(): Promise<number> {
    const s = await this.repo.getSetting(AVULSO_KEY)
    const v = s ? parseFloat(s.value) : 0
    return Number.isFinite(v) ? v : 0
  }

  private async getMinimo(): Promise<number> {
    const s = await this.repo.getSetting(MIN_CESTINHA_KEY)
    const v = s ? parseFloat(s.value) : DEFAULT_MIN_CESTINHA
    return Number.isFinite(v) ? v : DEFAULT_MIN_CESTINHA
  }

  /** Mínimo (R$) da parte em dinheiro para liberar cartão; 0 = sempre liberado (regra desligada). */
  private async getCartaoMinimo(): Promise<number> {
    const s = await this.repo.getSetting(MARKET_CARTAO_MIN_KEY)
    return parseCartaoMinimo(s?.value)
  }

  /** Mínimo em quantidade de pães do Pão Francês — herdado do pedido único. */
  private async getBreadMin(): Promise<number> {
    const s = await this.repo.getSetting(PEDIDO_MINIMO_UNICO_KEY)
    const v = s ? parseInt(s.value, 10) : 1
    return Number.isFinite(v) && v >= 1 ? v : 1
  }

  /** Id do produto fixo "Pão Francês" — ele só pode existir como breadQty, nunca como item. */
  private async getBreadProductId(): Promise<string | null> {
    const s = await this.repo.getSetting(BREAD_PRODUCT_KEY)
    return s?.value ?? null
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100
  }

  // ── Cestinha ────────────────────────────────────────────────────────────────
  /** Monta a visão da Cestinha juntando itens persistidos + Product (snapshot + subtotal). */
  private async buildCartView(
    rawItems: { productId: string; qty: number }[],
    breadQty: number,
  ): Promise<CartView> {
    const [avulsoUnit, minimo, breadMin, breadId, cartaoMinimo] = await Promise.all([
      this.getAvulsoUnit(),
      this.getMinimo(),
      this.getBreadMin(),
      this.getBreadProductId(),
      this.getCartaoMinimo(),
    ])

    // O produto-pão só pode existir como breadQty — se aparecer em items[], é ignorado
    // (auto-cura carrinhos antigos que o tenham como item separado).
    const cleanItems = rawItems.filter((i) => i.productId !== breadId)
    const ids = cleanItems.map((i) => i.productId)
    const products = await this.repo.findProductsByIds(ids)
    const byId = new Map(products.map((p) => [p.id, p]))

    const items: CartLineView[] = []
    for (const it of cleanItems) {
      const p = byId.get(it.productId)
      // Ignora produto inexistente ou inativo (some da Cestinha).
      if (!p || !p.isActive) continue
      // Teto por pedido (DAILY = capacidade/dia; FIXED = estoque). Clampa a quantidade ao teto —
      // auto-cura Cestinhas antigas acima do limite (ex.: 2 de um produto com capacidade 1).
      const maxQty = p.stockType === 'FIXED' ? Math.max(0, p.stock ?? 0) : Math.max(0, p.dailyCapacity ?? 0)
      let qty = Math.max(1, Math.min(99, it.qty))
      if (maxQty > 0) qty = Math.min(qty, maxQty)
      const lineTotal = this.round2(p.price * qty)
      const soldOut = maxQty <= 0
      items.push({
        productId: p.id,
        qty,
        name: p.name,
        price: p.price,
        photoUrl: p.photoUrl ?? null,
        categoryId: p.categoryId,
        lineTotal,
        soldOut,
        maxQty,
        stockType: p.stockType,
      })
    }

    const productSubtotal = this.round2(items.reduce((acc, l) => acc + l.lineTotal, 0))
    const safeBread = Math.max(0, Math.min(100, breadQty))
    const subtotal = this.round2(productSubtotal + safeBread * avulsoUnit)
    const count = items.reduce((acc, l) => acc + l.qty, 0)
    // Mínimo (segue o pedido único p/ o pão): carrinho só de pão respeita a quantidade mínima
    // (breadMin) e é isento do mínimo em R$; com produtos, vale o mínimo em R$ da Cestinha e o
    // pão ainda exige a quantidade mínima.
    const hasProducts = items.length > 0
    const hasBread = safeBread > 0
    const breadOk = !hasBread || safeBread >= breadMin
    const moneyMinOk = !hasProducts || subtotal >= minimo
    const meetsMinimum = (hasProducts || hasBread) && breadOk && moneyMinOk

    return {
      items,
      breadQty: safeBread,
      productSubtotal,
      subtotal,
      count,
      avulsoUnit,
      minimo,
      breadMin,
      cartaoMinimo,
      meetsMinimum,
    }
  }

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.repo.getCart(userId)
    const rawItems = (cart?.items ?? []).map((i) => ({ productId: i.productId, qty: i.qty }))
    return this.buildCartView(rawItems, cart?.breadQty ?? 0)
  }

  /**
   * Substitui a Cestinha do usuário (semântica de PUT). Normaliza: colapsa productIds
   * repetidos (soma qty, teto 99), remove qty<=0 e persiste só produtos existentes+ativos.
   * breadQty ausente = preserva o atual.
   */
  async updateCart(userId: string, input: UpdateCartInput): Promise<CartView> {
    // Colapsa duplicados por productId.
    const merged = new Map<string, number>()
    for (const it of input.items) {
      merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty)
    }

    const ids = [...merged.keys()]
    const [products, breadId] = await Promise.all([
      this.repo.findProductsByIds(ids),
      this.getBreadProductId(),
    ])
    const validIds = new Set(products.filter((p) => p.isActive).map((p) => p.id))
    // Teto por pedido de cada produto (DAILY = capacidade/dia; FIXED = estoque) — a quantidade
    // persistida nunca passa disso.
    const maxQtyById = new Map(
      products.map((p) => [p.id, p.stockType === 'FIXED' ? Math.max(0, p.stock ?? 0) : Math.max(0, p.dailyCapacity ?? 0)]),
    )

    const normalized: { productId: string; qty: number }[] = []
    for (const [productId, qtyRaw] of merged) {
      if (!validIds.has(productId)) continue // descarta inativo/inexistente
      if (productId === breadId) continue // o pão só existe como breadQty, nunca como item
      const cap = maxQtyById.get(productId) ?? 0
      let qty = Math.max(1, Math.min(99, qtyRaw))
      if (cap > 0) qty = Math.min(qty, cap)
      normalized.push({ productId, qty })
    }

    // breadQty: preserva o atual quando não enviado.
    let breadQty = input.breadQty
    if (breadQty === undefined) {
      const current = await this.repo.getCart(userId)
      breadQty = current?.breadQty ?? 0
    }
    breadQty = Math.max(0, Math.min(100, breadQty))

    await this.repo.upsertCart(userId, normalized, breadQty)
    return this.buildCartView(normalized, breadQty)
  }
}
