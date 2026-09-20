import { FastifyInstance } from 'fastify'
import type { UpdateCartInput } from '@cheirin-de-pao/shared'
import { MARKET_CARTAO_MIN_KEY, parseCartaoMinimo } from '../../lib/market-card-policy.js'
import { getMinimumsForUser } from '../../lib/order-minimums.js'
import { isNovidadeVigente, isUnavailableForClient, sortVitrine } from '../../lib/product-availability.js'
import { isPromoVigente, priceView } from '../../lib/product-pricing.js'
import { MarketRepository } from './market.repository.js'

// Abaixo disso, um produto FIXO exibe "Últimas unidades" no catálogo.
const LOW_STOCK_THRESHOLD = 5
const AVULSO_KEY = 'avulsoUnit'
const BREAD_PRODUCT_KEY = 'breadProductId'

// Linha da Cestinha com snapshot do produto (nome/preço/foto no momento da leitura).
export interface CartLineView {
  productId: string
  qty: number
  name: string
  price: number
  photoUrl: string | null
  categoryId: string
  /** Preço cheio, para o riscado. `null` quando não há promoção descontando. */
  priceBefore: number | null
  lineTotal: number
  /**
   * Não dá para comprar agora. UNIÃO de três causas — sem estoque, pausado pelo admin, ou fora do
   * horário de venda. O cliente lê as três como "Esgotado" e nunca sabe a diferença (o motivo real
   * só vai para o admin).
   */
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

  constructor(private fastify: FastifyInstance) {
    this.repo = new MarketRepository(fastify)
  }

  /**
   * Catálogo do cliente. Cada produto é avaliado contra o estoque, a pausa manual e o HORÁRIO DE
   * VENDA (relógio de loja) — nenhum dos três depende da data de entrega, que só é escolhida no
   * checkout. É o que permite a vitrine dizer "Esgotado" sem precisar perguntar nada ao cliente.
   */
  async getCatalog() {
    const [products, categories, avulsoUnit, breadRow] = await Promise.all([
      this.repo.listActiveProducts(),
      this.repo.listActiveCategories(),
      this.getAvulsoUnit(),
      this.repo.getSetting(BREAD_PRODUCT_KEY),
    ])
    const breadId = breadRow?.value ?? null
    const now = new Date()

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        sortOrder: c.sortOrder,
      })),
      // Três degraus: novidades → promoções destacadas → resto (atrás só do Pão Francês, que tem
      // card próprio). Precisa ser aqui e não no `orderBy`: o banco não sabe que um `newUntil` ou
      // um `promoUntil` venceu.
      products: sortVitrine(products, now).map((p) => {
        const isBread = p.id === breadId
        // Teto por pedido: FIXED = estoque atual; DAILY = capacidade por dia. Um único pedido
        // nunca pode passar do teto (independe da data), então o front limita o stepper por ele.
        const maxQty = p.stockType === 'FIXED' ? Math.max(0, p.stock ?? 0) : Math.max(0, p.dailyCapacity ?? 0)
        // Indisponível: sem estoque OU pausado pelo admin OU fora do horário de venda.
        // As três causas colapsam numa palavra só — o cliente lê "Esgotado" e pronto.
        const soldOut = isUnavailableForClient(p, { outOfStock: maxQty <= 0 }, now)
        const limited =
          p.stockType === 'FIXED' && p.stock != null && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
        // Preço já COM desconto + o cheio para o riscado. Tudo que deriva de preço (pãezinhos,
        // subtotal, mínimo, gancho grátis) acompanha sozinho, porque todos leem `price`.
        const view = priceView(p.price, p, now)
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          // Pão Francês: preço SEMPRE = avulso (o pão do pedido único), ignora o preço salvo.
          price: isBread ? avulsoUnit : view.price,
          priceBefore: isBread ? null : view.priceBefore,
          photoUrl: p.photoUrl,
          availableDays: (p.availableDays as string[] | null) ?? [],
          stockType: p.stockType,
          // Pão Francês compra via breadQty (fluxo próprio) → sem teto de stepper (null).
          maxQty: isBread ? null : maxQty,
          soldOut: isBread ? false : soldOut,
          limited: isBread ? false : limited,
          // O pão tem card próprio fora da grade — nunca recebe selo nenhum.
          // Os dois flags vão HONESTOS; qual selo aparece é decisão do card (novidade ganha).
          isNew: isBread ? false : isNovidadeVigente(p, now),
          isPromo: isBread ? false : isPromoVigente(p, now),
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

  /** Mínimo (R$) da parte em dinheiro para liberar cartão; 0 = sempre liberado (regra desligada). */
  private async getCartaoMinimo(): Promise<number> {
    const s = await this.repo.getSetting(MARKET_CARTAO_MIN_KEY)
    return parseCartaoMinimo(s?.value)
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
    userId: string,
    rawItems: { productId: string; qty: number }[],
    breadQty: number,
  ): Promise<CartView> {
    const [avulsoUnit, minimos, breadId, cartaoMinimo] = await Promise.all([
      this.getAvulsoUnit(),
      // Mínimos resolvidos para o condomínio do cliente (override ?? padrão global): o valor em
      // R$ da Cestinha e a quantidade mínima de pães, que segue o mínimo do pedido único.
      getMinimumsForUser(this.fastify.prisma, userId),
      this.getBreadProductId(),
      this.getCartaoMinimo(),
    ])
    const minimo = minimos.cestinha
    const breadMin = minimos.unico
    const now = new Date()

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
      // Preço COM desconto quando há promoção vigente — o subtotal, o mínimo da Cestinha e o
      // gatilho do gancho grátis passam todos por aqui e ficam corretos sem saber de promoção.
      const view = priceView(p.price, p, now)
      const lineTotal = this.round2(view.price * qty)
      // Mesma união do catálogo. `maxQty` e `qty` NÃO são zerados: a linha fica marcada e o
      // cliente decide remover — pausar um produto não pode esvaziar carrinho alheio em silêncio.
      const soldOut = isUnavailableForClient(p, { outOfStock: maxQty <= 0 }, now)
      items.push({
        productId: p.id,
        qty,
        name: p.name,
        price: view.price,
        photoUrl: p.photoUrl ?? null,
        categoryId: p.categoryId,
        priceBefore: view.priceBefore,
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
    return this.buildCartView(userId, rawItems, cart?.breadQty ?? 0)
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
    return this.buildCartView(userId, normalized, breadQty)
  }
}
