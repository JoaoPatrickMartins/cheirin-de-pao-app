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

  // Documento por fornecedor: sem a coluna "Fornecedor" (ele é o destinatário no cabeçalho);
  // o agrupamento é por PRODUTO, que é o que ele separa.
  const perSupplier = !!data.supplier

  sheet.columns = perSupplier
    ? [
        { header: 'Produto', key: 'product', width: 30 },
        { header: 'Qtd', key: 'quantity', width: 10 },
        { header: 'Custo unit.', key: 'unitPrice', width: 14 },
        { header: 'Total', key: 'total', width: 14 },
      ]
    : [
        { header: 'Fornecedor', key: 'supplier', width: 28 },
        { header: 'Produto', key: 'product', width: 28 },
        { header: 'Qtd', key: 'quantity', width: 10 },
        { header: 'Custo unit.', key: 'unitPrice', width: 14 },
        { header: 'Total', key: 'total', width: 14 },
      ]

  // Estilizar cabeçalho
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' },
  }

  // Cabeçalho acima da tabela: título, destinatário e contexto do pedido
  const subtitle = [
    `Data: ${data.date}`,
    data.slotLabel ? `Turno: ${data.slotLabel}` : '',
    // Reposição não tem pão: "Paes: 0" no cabeçalho de uma compra de geleia é ruído.
    data.kind !== 'RESTOCK' && data.breadTotal != null ? `Paes: ${data.breadTotal}` : '',
  ]
    .filter(Boolean)
    .join('   |   ')
  const docTitle = data.kind === 'RESTOCK' ? 'Reposição de Estoque' : 'Pedido ao Fornecedor'
  sheet.insertRow(1, [
    perSupplier ? `${docTitle} — ${data.supplier!.name} (CNPJ ${data.supplier!.cnpj})` : `${docTitle} — consolidado (uso interno)`,
  ])
  sheet.getRow(1).font = { bold: true, size: 14 }
  sheet.insertRow(2, [subtitle])
  sheet.insertRow(3, []) // linha em branco

  // Adicionar items
  data.items.forEach((item) => {
    sheet.addRow({
      supplier: item.supplier,
      product: item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })
  })

  // Linha de total
  sheet.addRow({
    supplier: perSupplier ? undefined : 'TOTAL',
    product: perSupplier ? 'TOTAL' : '',
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
