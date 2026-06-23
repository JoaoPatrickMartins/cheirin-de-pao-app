// admin-supplier-orders.service.ts — lógica de negócio para pedidos ao fornecedor
// Substitui o stub placeholder da Wave 0 (07-01-PLAN.md)
// Requirements: ADMO-05..09

import { FastifyInstance } from 'fastify'
import { AdminSupplierOrdersRepository } from './admin-supplier-orders.repository.js'
import { generatePdf } from './pdf-generator.js'
import { generateExcel } from './excel-generator.js'
import type { SupplierOrderData } from './pdf-generator.js'

/**
 * AdminSupplierOrdersService — lógica do fluxo de pedido ao fornecedor.
 *
 * Responsabilidades:
 * - getDraft: calcular totais de pães por condomínio para o dia seguinte
 * - create: criar PurchaseOrder DRAFT + items em $transaction
 * - finalize: mudar status DRAFT → FINALIZED (T-07-04-04: idempotência)
 * - getHistory: listar pedidos FINALIZED
 * - getPdfBuffer: gerar PDF do pedido
 * - getExcelBuffer: gerar Excel do pedido
 */
export class AdminSupplierOrdersService {
  private repository: AdminSupplierOrdersRepository

  constructor(private fastify: FastifyInstance) {
    this.repository = new AdminSupplierOrdersRepository(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * getDraft — retorna lista de condomínios com totais de pães para o dia seguinte (BRT).
   *
   * Busca Orders com scheduledDate = amanhã, status != CANCELLED.
   * Agrupa por condominiumId somando quantity e contando entregas.
   * Retorna array { condominiumId, name, deliveryCount, totalBreads }[] ordenado por nome.
   */
  async getDraft(): Promise<
    Array<{ condominiumId: string; name: string; deliveryCount: number; totalBreads: number }>
  > {
    // Calcular amanhã em BRT (UTC-3)
    const now = new Date()
    // Ajuste simples: adicionar 1 dia ao início do dia em UTC-3
    const tomorrowBrt = new Date(now)
    tomorrowBrt.setUTCHours(0, 0, 0, 0)
    tomorrowBrt.setUTCDate(tomorrowBrt.getUTCDate() + 1)
    // BRT = UTC-3 → início do dia BRT = 03:00 UTC
    const startOfTomorrow = new Date(tomorrowBrt.getTime() + 3 * 3600 * 1000)
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 3600 * 1000 - 1)

    // Buscar orders para amanhã (não canceladas)
    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: {
          gte: startOfTomorrow,
          lte: endOfTomorrow,
        },
        status: { not: 'CANCELLED' },
        condominiumId: { not: null },
      },
      select: {
        condominiumId: true,
        quantity: true,
      },
    })

    // Agrupar por condominiumId — soma de pães e contagem de entregas
    const grouped = new Map<string, { totalBreads: number; deliveryCount: number }>()
    for (const order of orders) {
      if (!order.condominiumId) continue
      const current = grouped.get(order.condominiumId) ?? { totalBreads: 0, deliveryCount: 0 }
      current.totalBreads += order.quantity
      current.deliveryCount += 1
      grouped.set(order.condominiumId, current)
    }

    // Buscar nomes dos condomínios
    const result: Array<{
      condominiumId: string
      name: string
      deliveryCount: number
      totalBreads: number
    }> = []
    for (const [condominiumId, { totalBreads, deliveryCount }] of grouped) {
      const condo = await this.prisma.condominium.findUnique({
        where: { id: condominiumId },
        select: { name: true },
      })
      result.push({
        condominiumId,
        name: condo?.name ?? condominiumId,
        deliveryCount,
        totalBreads,
      })
    }

    // Ordenar por nome
    return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  /**
   * create — cria PurchaseOrder DRAFT + PurchaseOrderItems em $transaction.
   *
   * T-07-04-03: verifica Supplier existe via findUnique antes de criar.
   *
   * @returns { id: string } ID do PurchaseOrder criado
   */
  async create(data: {
    items: Array<{ supplierId: string; quantity: number }>
    cutoffTime?: string
  }): Promise<{ id: string }> {
    // Calcular data = amanhã (data do pedido)
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)

    // Horário de corte — default 20:00 BRT
    const cutoffTime = data.cutoffTime
      ? new Date(data.cutoffTime)
      : new Date(new Date().setUTCHours(23, 0, 0, 0)) // 20:00 BRT = 23:00 UTC

    // Resolver preços dos fornecedores e validar existência
    const itemsWithPrice = await Promise.all(
      data.items.map(async (item) => {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: item.supplierId },
        })
        if (!supplier) {
          throw { statusCode: 404, message: `Fornecedor ${item.supplierId} não encontrado` }
        }
        return {
          supplierId: item.supplierId,
          quantity: item.quantity,
          unitPrice: supplier.pricePerUnit,
        }
      }),
    )

    const totalQuantity = itemsWithPrice.reduce((sum, item) => sum + item.quantity, 0)

    const order = await this.repository.create({
      date: tomorrow,
      cutoffTime,
      totalQuantity,
      items: itemsWithPrice,
    })

    return { id: order.id }
  }

  /**
   * finalize — muda status DRAFT → FINALIZED.
   *
   * T-07-04-04: verifica status=DRAFT antes de finalizar — retorna 400 se já FINALIZED.
   *
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   * @throws { statusCode: 400 } se status já é FINALIZED
   */
  async finalize(id: string): Promise<void> {
    const order = await this.repository.findById(id)

    if (!order) {
      throw { statusCode: 404, message: 'Pedido ao fornecedor não encontrado' }
    }

    if (order.status === 'FINALIZED') {
      throw { statusCode: 400, message: 'Pedido já foi finalizado' }
    }

    await this.repository.finalize(id)
  }

  /**
   * getHistory — retorna histórico de pedidos FINALIZED.
   */
  async getHistory() {
    return this.repository.findHistory()
  }

  /**
   * getPdfBuffer — gera Buffer PDF do pedido ao fornecedor.
   *
   * T-07-04-01: autenticação e role check ficam no controller.
   *
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   */
  async getPdfBuffer(id: string): Promise<Buffer> {
    const data = await this._buildSupplierOrderData(id)
    return generatePdf(data)
  }

  /**
   * getExcelBuffer — gera Buffer Excel do pedido ao fornecedor.
   *
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   */
  async getExcelBuffer(id: string): Promise<Buffer> {
    const data = await this._buildSupplierOrderData(id)
    return generateExcel(data)
  }

  /**
   * _buildSupplierOrderData — helper privado que busca dados do pedido
   * e formata para o SupplierOrderData usado pelos geradores.
   */
  private async _buildSupplierOrderData(id: string): Promise<SupplierOrderData> {
    const orderWithItems = await this.repository.findByIdWithItems(id)

    if (!orderWithItems) {
      throw { statusCode: 404, message: 'Pedido ao fornecedor não encontrado' }
    }

    // Buscar nomes dos fornecedores para cada item
    const items = await Promise.all(
      orderWithItems.items.map(async (item) => {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: item.supplierId },
          select: { name: true, pricePerUnit: true },
        })
        return {
          supplier: supplier?.name ?? item.supplierId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        }
      }),
    )

    const grandTotal = items.reduce((sum, item) => sum + item.quantity, 0)
    const grandTotalValue = items.reduce((sum, item) => sum + item.total, 0)

    // Formatar data BRT
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(orderWithItems.date)

    return {
      date: dateFormatted,
      items,
      grandTotal,
      grandTotalBrl: `R$ ${grandTotalValue.toFixed(2).replace('.', ',')}`,
    }
  }
}
