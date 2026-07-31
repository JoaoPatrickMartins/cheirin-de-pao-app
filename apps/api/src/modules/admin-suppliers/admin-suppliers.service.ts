import { FastifyInstance } from 'fastify'
import {
  CreateSupplierBody,
  UpdateSupplierBody,
  SetSupplierProductsBody,
} from './admin-suppliers.schema.js'
import { AdminSuppliersRepository } from './admin-suppliers.repository.js'
import { brtDayRange } from '../../lib/cutoff.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'

/** Uma linha da matriz na visão do fornecedor (form do fornecedor). */
export interface SupplierProductView {
  productId: string
  productName: string
  productActive: boolean
  stockType: string
  unitCost: number
  defaultSharePct: number
  isPreferred: boolean
  minOrderQty: number | null
  isActive: boolean
}

/** A mesma matriz vista pelo produto (leitura, no form do produto). */
export interface ProductSupplierView {
  supplierId: string
  supplierName: string
  supplierActive: boolean
  unitCost: number
  defaultSharePct: number
  isPreferred: boolean
  minOrderQty: number | null
  isActive: boolean
}

/**
 * AdminSuppliersService — lógica de negócio para CRUD de fornecedores e da matriz de fornecimento.
 *
 * T-07-03-03: Garantia de único isPrincipal via updateMany antes do create/update.
 * T-07-03-01: Role check ADMIN fica no controller (não no service).
 */
export class AdminSuppliersService {
  private repo: AdminSuppliersRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new AdminSuppliersRepository(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  async list() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  }

  async getById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw { statusCode: 404, message: 'Fornecedor não encontrado' }
    return supplier
  }

  async create(data: CreateSupplierBody) {
    // T-07-03-03: se isPrincipal=true, desativar todos os outros antes de criar
    if (data.isPrincipal) {
      await this.prisma.supplier.updateMany({
        where: { isPrincipal: true },
        data: { isPrincipal: false },
      })
    }
    return this.prisma.supplier.create({ data })
  }

  async update(id: string, data: UpdateSupplierBody) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Fornecedor não encontrado' }

    // Não pode existir fornecedor principal inativo — a geração de pedido escolhe o principal.
    // Bloqueia tanto desativar o principal atual quanto marcar como principal já inativo.
    const willBePrincipal = data.isPrincipal ?? existing.isPrincipal
    const willBeActive = data.isActive ?? existing.isActive
    if (willBePrincipal && !willBeActive) {
      throw {
        statusCode: 409,
        message: 'Defina outro fornecedor como principal antes de desativar este.',
      }
    }

    // T-07-03-03: se isPrincipal=true no update, desativar os outros primeiro
    if (data.isPrincipal) {
      await this.prisma.supplier.updateMany({
        where: { isPrincipal: true },
        data: { isPrincipal: false },
      })
    }

    return this.prisma.supplier.update({ where: { id }, data })
  }

  async remove(id: string) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Fornecedor não encontrado' }
    // A matriz de fornecimento deste fornecedor morre com ele — senão sobrariam linhas órfãs
    // apontando para um fornecedor inexistente, que o rateio teria de filtrar para sempre.
    await this.prisma.supplierProduct.deleteMany({ where: { supplierId: id } })
    return this.prisma.supplier.delete({ where: { id } })
  }

  // ── Matriz de fornecimento (D-7/D-8) ────────────────────────────────────────

  /** Produtos que este fornecedor fornece, com nome e estado do produto para a tela. */
  async listProductsOfSupplier(supplierId: string): Promise<SupplierProductView[]> {
    await this.getById(supplierId) // 404 se o fornecedor não existe
    const rows = await this.repo.findProductsOfSupplier(supplierId)
    if (rows.length === 0) return []
    const products = await this.repo.findProductsByIds(rows.map((r) => r.productId))
    const byId = new Map(products.map((p) => [p.id, p]))
    return rows
      .map((r) => {
        const p = byId.get(r.productId)
        return {
          productId: r.productId,
          productName: p?.name ?? '(produto removido)',
          productActive: p?.isActive ?? false,
          stockType: p?.stockType ?? '',
          unitCost: r.unitCost,
          defaultSharePct: r.defaultSharePct,
          isPreferred: r.isPreferred,
          minOrderQty: r.minOrderQty,
          isActive: r.isActive,
        }
      })
      .sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR'))
  }

  /** Visão espelhada: quem fornece um produto (leitura, para o form do produto). */
  async listSuppliersOfProduct(productId: string): Promise<ProductSupplierView[]> {
    const rows = await this.repo.findSuppliersOfProduct(productId)
    if (rows.length === 0) return []
    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: rows.map((r) => r.supplierId) } },
      select: { id: true, name: true, isActive: true },
    })
    const byId = new Map(suppliers.map((s) => [s.id, s]))
    return rows
      .map((r) => {
        const s = byId.get(r.supplierId)
        return {
          supplierId: r.supplierId,
          supplierName: s?.name ?? '(fornecedor removido)',
          supplierActive: s?.isActive ?? false,
          unitCost: r.unitCost,
          defaultSharePct: r.defaultSharePct,
          isPreferred: r.isPreferred,
          minOrderQty: r.minOrderQty,
          isActive: r.isActive,
        }
      })
      .sort((a, b) => {
        if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1
        return a.supplierName.localeCompare(b.supplierName, 'pt-BR')
      })
  }

  /**
   * setProductsOfSupplier — substitui o conjunto de produtos que o fornecedor fornece.
   *
   * Enviar a lista COMPLETA: produto ausente deixa de ser fornecido (a linha é apagada). É o que
   * torna a regra de D-8 verdadeira — "linha existe ⇔ fornece", sem estado intermediário.
   *
   * Validações:
   *  - produto existe (produto inativo é aceito: o fornecimento pode ser cadastrado antes de ativar);
   *  - sem `productId` repetido no payload;
   *  - **Σ `defaultSharePct` por produto ∈ {0, 100}** contando os OUTROS fornecedores ativos —
   *    um rateio que soma 90 ou 110 geraria pedido errado em silêncio;
   *  - remover a última linha de um produto **com demanda futura** → 409 (senão o produto vendido
   *    para amanhã ficaria sem quem fornecer, e o pedido ao fornecedor sairia incompleto).
   *
   * @throws 404 fornecedor/produto inexistente · 409 regra de negócio violada
   */
  async setProductsOfSupplier(
    supplierId: string,
    input: SetSupplierProductsBody,
  ): Promise<SupplierProductView[]> {
    await this.getById(supplierId)

    const incoming = input.products
    const ids = incoming.map((p) => p.productId)
    const dup = ids.find((id, i) => ids.indexOf(id) !== i)
    if (dup) throw { statusCode: 409, message: 'O mesmo produto apareceu duas vezes na lista.' }

    if (ids.length > 0) {
      const found = await this.repo.findProductsByIds(ids)
      const foundIds = new Set(found.map((p) => p.id))
      const missing = ids.filter((id) => !foundIds.has(id))
      if (missing.length > 0) {
        throw { statusCode: 404, message: `Produto não encontrado: ${missing.join(', ')}` }
      }
      const nameById = new Map(found.map((p) => [p.id, p.name]))

      // Σ das fatias por produto, considerando os outros fornecedores ATIVOS.
      for (const p of incoming) {
        if (!p.isActive) continue
        const others = await this.repo.findOtherSharesForProduct(p.productId, supplierId)
        const sum = others.reduce((s, o) => s + o.defaultSharePct, 0) + p.defaultSharePct
        if (sum !== 0 && sum !== 100) {
          const name = nameById.get(p.productId) ?? p.productId
          const diff = sum < 100 ? `faltam ${100 - sum}` : `sobram ${sum - 100}`
          throw {
            statusCode: 409,
            message: `As fatias de "${name}" somam ${sum}% — ${diff}%. Use 0% em todos (o padrão leva tudo) ou feche em 100%.`,
          }
        }
      }
    }

    // O que sai: linhas atuais que não vieram no payload.
    const current = await this.repo.findProductsOfSupplier(supplierId)
    const incomingSet = new Set(ids)
    const removed = current.filter((c) => !incomingSet.has(c.productId)).map((c) => c.productId)
    if (removed.length > 0) await this.assertNoOrphanDemand(supplierId, removed)

    for (const p of incoming) {
      await this.repo.upsertSupplierProduct(supplierId, p.productId, {
        unitCost: p.unitCost,
        defaultSharePct: p.defaultSharePct,
        isPreferred: p.isPreferred,
        minOrderQty: p.minOrderQty ?? null,
        isActive: p.isActive,
      })
      // Só um preferido por produto — o motor de rateio usa o preferido como dono do resto.
      if (p.isPreferred) await this.repo.clearPreferredForProduct(p.productId, supplierId)
    }
    if (removed.length > 0) await this.repo.deleteSupplierProducts(supplierId, removed)

    return this.listProductsOfSupplier(supplierId)
  }

  /**
   * Barra deixar um produto COM DEMANDA FUTURA sem nenhum fornecedor.
   * "Demanda futura" = Cestinha confirmada de hoje em diante que contém o produto.
   */
  private async assertNoOrphanDemand(supplierId: string, productIds: string[]): Promise<void> {
    for (const productId of productIds) {
      const others = await this.repo.findOtherSharesForProduct(productId, supplierId)
      if (others.length > 0) continue // sobra alguém fornecendo → pode remover

      const todayStart = brtDayRange(new Date()).start
      const pending = await this.prisma.marketOrder.findFirst({
        where: {
          scheduledDate: { gte: todayStart },
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
          items: { some: { productId } },
        },
        select: { id: true },
      })
      if (!pending) continue

      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { name: true } })
      throw {
        statusCode: 409,
        message: `"${product?.name ?? productId}" tem pedido confirmado para os próximos dias e este é o único fornecedor. Cadastre outro fornecedor antes de remover.`,
      }
    }
  }
}
