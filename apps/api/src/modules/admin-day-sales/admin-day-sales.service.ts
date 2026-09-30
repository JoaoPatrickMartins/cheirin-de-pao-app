// admin-day-sales.service.ts — relatório de itens vendidos de um dia de entrega.
//
// Módulo próprio (e não mais 200 linhas em admin-supplier-orders) porque isto é VENDA, não
// compra: as fontes são as mesmas, a pergunta é outra. A agregação vive em `lib/day-sales.ts`;
// aqui fica só a borda: validar a data e montar os documentos.

import { FastifyInstance } from 'fastify'
import { buildDaySales, type DaySales } from '../../lib/day-sales.js'
import { brtDateStr } from '../../lib/cutoff.js'
import { generateDaySalesPdf } from './day-sales-pdf.js'
import { generateDaySalesExcel } from './day-sales-excel.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class AdminDaySalesService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Data alvo: a informada (YYYY-MM-DD BRT) ou hoje. Formato inválido é erro, não silêncio. */
  private resolveDate(dateStr?: string): string {
    if (dateStr == null || dateStr === '') return brtDateStr(new Date())
    if (!DATE_RE.test(dateStr)) {
      throw { statusCode: 400, message: 'date deve estar no formato YYYY-MM-DD' }
    }
    return dateStr
  }

  async getReport(dateStr?: string): Promise<DaySales> {
    return buildDaySales(this.prisma, this.resolveDate(dateStr))
  }

  async getPdfBuffer(dateStr?: string): Promise<Buffer> {
    return generateDaySalesPdf(await this.getReport(dateStr))
  }

  async getExcelBuffer(dateStr?: string): Promise<Buffer> {
    return generateDaySalesExcel(await this.getReport(dateStr))
  }
}
