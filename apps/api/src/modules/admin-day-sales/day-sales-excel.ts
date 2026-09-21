// day-sales-excel.ts — planilha do relatório de itens vendidos do dia.
//
// Mesma stack do pedido ao fornecedor (exceljs v4, `writeBuffer()`). Duas abas porque as duas
// perguntas são diferentes: "o que saiu" (por produto) e "quando saiu" (por turno). Valores vão
// como NÚMERO com formato de moeda, não como texto — quem baixa uma planilha vai somar nela.

import ExcelJS from 'exceljs'
import type { DaySales } from '../../lib/day-sales.js'
import { formatDayLong, formatApuradoEm } from './day-sales-format.js'

const BRL_FORMAT = 'R$ #,##0.00'
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF0F0F0' },
}

/** generateDaySalesExcel — Buffer XLSX do relatório de um dia. */
export async function generateDaySalesExcel(report: DaySales): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Cheirin de Pao'
  workbook.created = new Date()

  // ── Aba 1: itens vendidos ────────────────────────────────────────────────
  const sheet = workbook.addWorksheet('Itens vendidos')
  sheet.columns = [
    { header: 'Produto', key: 'name', width: 34 },
    { header: 'Qtd', key: 'qty', width: 10 },
    { header: 'Preço médio', key: 'avg', width: 14 },
    { header: 'Total', key: 'revenue', width: 14 },
  ]
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = HEADER_FILL

  const { breads, items, counts } = report
  const resumo = [
    `${breads.total} pães`,
    `${items.total} ${items.total === 1 ? 'item' : 'itens'}`,
    `${counts.stops} ${counts.stops === 1 ? 'parada' : 'paradas'}`,
    `${counts.clients} ${counts.clients === 1 ? 'cliente' : 'clientes'}`,
    `${counts.condominiums} ${counts.condominiums === 1 ? 'condomínio' : 'condomínios'}`,
  ].join('   |   ')

  sheet.insertRow(1, [`Itens vendidos — ${formatDayLong(report.date)}`])
  sheet.getRow(1).font = { bold: true, size: 14 }
  sheet.insertRow(2, [`Apurado em ${formatApuradoEm(report.generatedAt)}`])
  sheet.insertRow(3, [resumo])
  sheet.insertRow(4, [])

  for (const line of report.lines) {
    const row = sheet.addRow({
      name: line.name,
      qty: line.qty,
      avg: line.avgUnitPrice,
      revenue: line.revenue,
    })
    if (line.isBread) row.font = { bold: true }
  }

  const totalRow = sheet.addRow({
    name: 'TOTAL',
    qty: breads.total + items.total,
    avg: null,
    revenue: report.totalRevenue,
  })
  totalRow.font = { bold: true }

  sheet.getColumn('avg').numFmt = BRL_FORMAT
  sheet.getColumn('revenue').numFmt = BRL_FORMAT

  // Rodapé: o mesmo aviso do PDF — sem ele, o total vira "faturamento do dia" na cabeça de quem lê.
  sheet.addRow([])
  sheet.addRow([
    `Pães valorizados ao preço do avulso (R$ ${breads.unitPrice.toFixed(2)}); o pão da agenda foi pago em pãezinhos de combo, em outra data.`,
  ])
  sheet.addRow(['Conta o que foi VENDIDO para este dia — não o que foi entregue.'])
  sheet.addRow([
    `Origem dos pães: avulso ${breads.single} · agenda ${breads.scheduled} · Cestinha ${breads.fromMarket}`,
  ])
  sheet.addRow([
    `Recebido na Cestinha: R$ ${report.cash.money.toFixed(2)} em dinheiro + ${(report.cash.creditsMilli / 1000).toFixed(1)} pãezinhos em crédito`,
  ])

  // ── Aba 2: por turno ─────────────────────────────────────────────────────
  const slotSheet = workbook.addWorksheet('Por turno')
  slotSheet.columns = [
    { header: 'Turno', key: 'label', width: 20 },
    { header: 'Pães', key: 'breads', width: 10 },
    { header: 'Itens', key: 'items', width: 10 },
    { header: 'Total', key: 'revenue', width: 14 },
  ]
  const slotHeader = slotSheet.getRow(1)
  slotHeader.font = { bold: true }
  slotHeader.fill = HEADER_FILL

  for (const s of report.slots) {
    slotSheet.addRow({ label: s.label, breads: s.breads, items: s.items, revenue: s.revenue })
  }
  slotSheet.getColumn('revenue').numFmt = BRL_FORMAT

  return workbook.xlsx.writeBuffer() as Promise<Buffer>
}
