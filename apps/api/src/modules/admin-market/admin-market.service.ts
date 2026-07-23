import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@cheirin-de-pao/shared'
import { AdminMarketRepository } from './admin-market.repository.js'
import type { SetStockBody } from './admin-market.schema.js'

// Abaixo disso, um produto de estoque FIXO dispara o alerta de "estoque baixo" no admin.
const LOW_STOCK_THRESHOLD = 5
const MIN_CESTINHA_KEY = 'marketMinimoCestinha'
const DEFAULT_MIN_CESTINHA = 15

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

  private isLowStock(p: { stockType: string; stock: number | null }): boolean {
    return p.stockType === 'FIXED' && p.stock != null && p.stock <= LOW_STOCK_THRESHOLD
  }

  private withFlags<T extends { stockType: string; stock: number | null }>(p: T) {
    return { ...p, lowStock: this.isLowStock(p) }
  }

  // ── Produtos ──
  async listProducts() {
    const products = await this.repo.listProducts()
    return products.map((p) => this.withFlags(p))
  }

  async getProduct(id: string) {
    const p = await this.repo.findProduct(id)
    if (!p) throw { statusCode: 404, message: 'Produto não encontrado' }
    return this.withFlags(p)
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
  async getConfig(): Promise<{ minimo: number }> {
    const s = await this.repo.getSetting(MIN_CESTINHA_KEY)
    const minimo = s ? parseFloat(s.value) : DEFAULT_MIN_CESTINHA
    return { minimo: Number.isFinite(minimo) ? minimo : DEFAULT_MIN_CESTINHA }
  }

  async setConfig(minimo: number): Promise<{ minimo: number }> {
    await this.repo.upsertSetting(MIN_CESTINHA_KEY, String(minimo))
    return { minimo }
  }
}
