// admin-supplier-orders.repository.ts — acesso ao banco para pedidos ao fornecedor
// Padrão baseado em payments.repository.ts
// Requirements: ADMO-05..09

import { FastifyInstance } from 'fastify'

/**
 * AdminSupplierOrdersRepository — camada de acesso ao MongoDB via Prisma.
 */
export class AdminSupplierOrdersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * findById — busca PurchaseOrder por ID (sem items).
   */
  async findById(id: string) {
    return this.prisma.purchaseOrder.findUnique({ where: { id } })
  }

  /**
   * findByIdWithItems — busca PurchaseOrder com seus PurchaseOrderItems.
   */
  async findByIdWithItems(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } })
    if (!order) return null
    const items = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
    })
    return { ...order, items }
  }

  /**
   * findHistory — retorna PurchaseOrders com status FINALIZED, ordenados por data desc.
   */
  async findHistory() {
    return this.prisma.purchaseOrder.findMany({
      where: { status: 'FINALIZED' },
      orderBy: { date: 'desc' },
    })
  }

  /**
   * create — cria PurchaseOrder + PurchaseOrderItems em $transaction atômica.
   *
   * T-07-04-03: supplierId validado pelo service antes de chamar create.
   */
  async create(data: {
    date: Date
    cutoffTime: Date
    totalQuantity: number
    items: Array<{ supplierId: string; quantity: number; unitPrice: number }>
  }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          date: data.date,
          cutoffTime: data.cutoffTime,
          totalQuantity: data.totalQuantity,
          status: 'DRAFT',
        },
      })

      await tx.purchaseOrderItem.createMany({
        data: data.items.map((item) => ({
          purchaseOrderId: order.id,
          supplierId: item.supplierId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      })

      return order
    })
  }

  /**
   * finalize — atualiza status para FINALIZED.
   */
  async finalize(id: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'FINALIZED' },
    })
  }
}
