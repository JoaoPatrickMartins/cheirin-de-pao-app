import { FastifyInstance } from 'fastify'
import { CreateSupplierBody, UpdateSupplierBody } from './admin-suppliers.schema.js'

export class AdminSuppliersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } })
  }

  create(data: CreateSupplierBody) {
    return this.prisma.supplier.create({ data })
  }

  update(id: string, data: UpdateSupplierBody) {
    return this.prisma.supplier.update({ where: { id }, data })
  }

  remove(id: string) {
    return this.prisma.supplier.delete({ where: { id } })
  }

  desativarPrincipais() {
    return this.prisma.supplier.updateMany({
      where: { isPrincipal: true },
      data: { isPrincipal: false },
    })
  }

  // ── Matriz de fornecimento (SupplierProduct) ──
  findProductsOfSupplier(supplierId: string) {
    return this.prisma.supplierProduct.findMany({ where: { supplierId } })
  }

  findSuppliersOfProduct(productId: string) {
    return this.prisma.supplierProduct.findMany({ where: { productId } })
  }

  /** Linhas de OUTROS fornecedores para um produto — base da validação de Σ fatias. */
  findOtherSharesForProduct(productId: string, exceptSupplierId: string) {
    return this.prisma.supplierProduct.findMany({
      where: { productId, supplierId: { not: exceptSupplierId }, isActive: true },
      select: { supplierId: true, defaultSharePct: true },
    })
  }

  upsertSupplierProduct(
    supplierId: string,
    productId: string,
    data: { unitCost: number; defaultSharePct: number; isPreferred: boolean; minOrderQty?: number | null; isActive: boolean },
  ) {
    return this.prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId, productId } },
      create: { supplierId, productId, ...data },
      update: data,
    })
  }

  deleteSupplierProducts(supplierId: string, productIds: string[]) {
    return this.prisma.supplierProduct.deleteMany({
      where: { supplierId, productId: { in: productIds } },
    })
  }

  /** Desmarca o preferido dos OUTROS fornecedores de um produto (só um por produto). */
  clearPreferredForProduct(productId: string, exceptSupplierId: string) {
    return this.prisma.supplierProduct.updateMany({
      where: { productId, supplierId: { not: exceptSupplierId }, isPreferred: true },
      data: { isPreferred: false },
    })
  }

  findProductsByIds(ids: string[]) {
    return this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, isActive: true, stockType: true },
    })
  }
}
