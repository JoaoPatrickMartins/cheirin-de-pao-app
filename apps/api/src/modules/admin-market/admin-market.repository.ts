import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'

/**
 * AdminMarketRepository — acesso ao banco para produtos, categorias e config do mini market.
 * Padrão: private get prisma (igual admin-combos).
 */
export class AdminMarketRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  // ── Produtos ──
  listProducts() {
    return this.prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  }
  findProduct(id: string) {
    return this.prisma.product.findUnique({ where: { id } })
  }
  createProduct(data: Prisma.ProductUncheckedCreateInput) {
    return this.prisma.product.create({ data })
  }
  updateProduct(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return this.prisma.product.update({ where: { id }, data })
  }
  deleteProduct(id: string) {
    return this.prisma.product.delete({ where: { id } })
  }
  countProductsInCategory(categoryId: string) {
    return this.prisma.product.count({ where: { categoryId } })
  }

  // ── Categorias ──
  listCategories() {
    return this.prisma.productCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  }
  findCategory(id: string) {
    return this.prisma.productCategory.findUnique({ where: { id } })
  }
  createCategory(data: Prisma.ProductCategoryUncheckedCreateInput) {
    return this.prisma.productCategory.create({ data })
  }
  updateCategory(id: string, data: Prisma.ProductCategoryUncheckedUpdateInput) {
    return this.prisma.productCategory.update({ where: { id }, data })
  }
  deleteCategory(id: string) {
    return this.prisma.productCategory.delete({ where: { id } })
  }

  // ── Config (Setting chave/valor) ──
  getSetting(key: string) {
    return this.prisma.setting.findUnique({ where: { key } })
  }
  upsertSetting(key: string, value: string) {
    return this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
  }
}
