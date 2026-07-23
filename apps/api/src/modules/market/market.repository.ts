import { FastifyInstance } from 'fastify'

/**
 * MarketRepository — leituras públicas (cliente) do catálogo + carrinho ("Cestinha")
 * persistente por usuário.
 */
export class MarketRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  listActiveProducts() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  listActiveCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  // ── Carrinho ("Cestinha") ─────────────────────────────────────────────────
  getCart(userId: string) {
    return this.prisma.cart.findUnique({ where: { userId } })
  }

  upsertCart(userId: string, items: { productId: string; qty: number }[], breadQty: number) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId, items: { set: items }, breadQty },
      update: { items: { set: items }, breadQty },
    })
  }

  findProductsByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([])
    return this.prisma.product.findMany({ where: { id: { in: ids } } })
  }

  getSetting(key: string) {
    return this.prisma.setting.findUnique({ where: { key } })
  }
}
