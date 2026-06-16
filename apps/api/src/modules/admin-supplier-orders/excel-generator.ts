// excel-generator.ts — geração de Excel (.xlsx) do pedido ao fornecedor
// Usa exceljs v4.4.0 com writeBuffer() que retorna Buffer
// Requirements: ADMO-08

import ExcelJS from 'exceljs'
import type { SupplierOrderData } from './pdf-generator.js'

/**
 * generateExcel — gera Buffer XLSX do pedido ao fornecedor.
 *
 * Cria uma worksheet "Pedido ao Fornecedor" com 4 colunas:
 * Fornecedor | Paes | Preco/Pao | Total
 *
 * @param data - Dados do pedido formatados
 * @returns Promise<Buffer> — Buffer do XLSX gerado (mínimo 100 bytes para input válido)
 */
export async function generateExcel(data: SupplierOrderData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Cheirin de Pao'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Pedido ao Fornecedor')

  // Definir colunas (4 conforme spec)
  sheet.columns = [
    { header: 'Fornecedor', key: 'supplier', width: 30 },
    { header: 'Paes', key: 'quantity', width: 10 },
    { header: 'Preco/Pao', key: 'unitPrice', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
  ]

  // Estilizar cabeçalho
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' },
  }

  // Adicionar data do pedido acima da tabela
  sheet.insertRow(1, [`Pedido ao Fornecedor — ${data.date}`])
  sheet.getRow(1).font = { bold: true, size: 14 }
  sheet.insertRow(2, []) // linha em branco

  // Adicionar items
  data.items.forEach((item) => {
    sheet.addRow({
      supplier: item.supplier,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })
  })

  // Linha de total
  sheet.addRow({
    supplier: 'TOTAL',
    quantity: data.grandTotal,
    unitPrice: '',
    total: data.grandTotalBrl,
  })

  // Estilizar linha de total (última linha)
  const totalRow = sheet.lastRow
  if (totalRow) {
    totalRow.font = { bold: true }
  }

  return workbook.xlsx.writeBuffer() as Promise<Buffer>
}
