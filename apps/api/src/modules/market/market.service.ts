import { FastifyInstance } from 'fastify'
import type { UpdateCartInput } from '@cheirin-de-pao/shared'
import { MarketRepository } from './market.repository.js'

// Abaixo disso, um produto FIXO exibe "Últimas unidades" no catálogo.
const LOW_STOCK_THRESHOLD = 5
const AVULSO_KEY = 'avulsoUnit'
const MIN_CESTINHA_KEY = 'marketMinimoCestinha'
const DEFAULT_MIN_CESTINHA = 15

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
    const [products, categories] = await Promise.all([
      this.repo.listActiveProducts(),
      this.repo.listActiveCategories(),
    ])

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        sortOrder: c.sortOrder,
      })),
      products: products.map((p) => {
        const soldOut = p.stockType === 'FIXED' && p.stock != null && p.stock <= 0
        const limited =
          p.stockType === 'FIXED' && p.stock != null && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          price: p.price,
          photoUrl: p.photoUrl,
          availableDays: (p.availableDays as string[] | null) ?? [],
          soldOut,
          limited,
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

  private round2(n: number): number {
    return Math.round(n * 100) / 100
  }

  // ── Cestinha ────────────────────────────────────────────────────────────────
  /** Monta a visão da Cestinha juntando itens persistidos + Product (snapshot + subtotal). */
  private async buildCartView(
    rawItems: { productId: string; qty: number }[],
    breadQty: number,
  ): Promise<CartView> {
    const [avulsoUnit, minimo] = await Promise.all([this.getAvulsoUnit(), this.getMinimo()])

    const ids = rawItems.map((i) => i.productId)
    const products = await this.repo.findProductsByIds(ids)
    const byId = new Map(products.map((p) => [p.id, p]))

    const items: CartLineView[] = []
    for (const it of rawItems) {
      const p = byId.get(it.productId)
      // Ignora produto inexistente ou inativo (some da Cestinha).
      if (!p || !p.isActive) continue
      const qty = Math.max(1, Math.min(99, it.qty))
      const lineTotal = this.round2(p.price * qty)
      const soldOut = p.stockType === 'FIXED' && p.stock != null && p.stock <= 0
      items.push({
        productId: p.id,
        qty,
        name: p.name,
        price: p.price,
        photoUrl: p.photoUrl ?? null,
        categoryId: p.categoryId,
        lineTotal,
        soldOut,
      })
    }

    const productSubtotal = this.round2(items.reduce((acc, l) => acc + l.lineTotal, 0))
    const safeBread = Math.max(0, Math.min(100, breadQty))
    const subtotal = this.round2(productSubtotal + safeBread * avulsoUnit)
    const count = items.reduce((acc, l) => acc + l.qty, 0)
    // O mínimo só faz sentido com algo na Cestinha.
    const hasContent = items.length > 0 || safeBread > 0
    const meetsMinimum = hasContent && subtotal >= minimo

    return {
      items,
      breadQty: safeBread,
      productSubtotal,
      subtotal,
      count,
      avulsoUnit,
      minimo,
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
    const products = await this.repo.findProductsByIds(ids)
    const validIds = new Set(products.filter((p) => p.isActive).map((p) => p.id))

    const normalized: { productId: string; qty: number }[] = []
    for (const [productId, qtyRaw] of merged) {
      if (!validIds.has(productId)) continue // descarta inativo/inexistente
      const qty = Math.max(1, Math.min(99, qtyRaw))
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
