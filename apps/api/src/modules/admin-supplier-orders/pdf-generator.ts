// pdf-generator.ts — geração de PDF do pedido ao fornecedor
// Usa pdfmake v0.3 com getBuffer() (Promise, sem callback — incompatível com v0.2)
// Import: pdfmake/js/index.js (não 'pdfmake' diretamente)
// Fontes: Helvetica built-in (sem vfs_fonts.js)
// Requirements: ADMO-08

import pdfmake from 'pdfmake/js/index.js'

/**
 * SupplierOrderData — dados compartilhados entre PDF e Excel generator.
 * Exportado para reutilização no service.
 */
export interface SupplierOrderData {
  /** Data formatada ex: "15/06/2026" */
  date: string
  items: Array<{
    /** Nome do fornecedor */
    supplier: string
    /** Quantidade de pães */
    quantity: number
    /** Preço unitário em R$ */
    unitPrice: number
    /** Total (quantity * unitPrice) */
    total: number
  }>
  /** Total geral de pães */
  grandTotal: number
  /** Total geral formatado ex: "R$ 50,00" */
  grandTotalBrl: string
}

// Configurar fontes Helvetica built-in (pdfmake v0.3 — sem vfs_fonts.js)
pdfmake.addFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
})

/**
 * generatePdf — gera Buffer PDF do pedido ao fornecedor.
 *
 * @param data - Dados do pedido formatados
 * @returns Promise<Buffer> — Buffer do PDF gerado (mínimo 100 bytes para input válido)
 */
export async function generatePdf(data: SupplierOrderData): Promise<Buffer> {
  const tableBody: unknown[][] = [
    [
      { text: 'Fornecedor', style: 'tableHeader' },
      { text: 'Paes', style: 'tableHeader' },
      { text: 'Preco/Pao', style: 'tableHeader' },
      { text: 'Total (R$)', style: 'tableHeader' },
    ],
    ...data.items.map((item) => [
      item.supplier,
      item.quantity.toString(),
      `R$ ${item.unitPrice.toFixed(2)}`,
      `R$ ${item.total.toFixed(2)}`,
    ]),
    [
      { text: 'TOTAL', bold: true, colSpan: 1 },
      { text: data.grandTotal.toString(), bold: true },
      '',
      { text: data.grandTotalBrl, bold: true },
    ],
  ]

  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 11 },
    content: [
      { text: 'Pedido ao Fornecedor', style: 'header' },
      { text: `Data: ${data.date}`, margin: [0, 4, 0, 16] },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto'],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      tableHeader: { bold: true, fillColor: '#f0f0f0' },
    },
  }

  // pdfmake v0.3: getBuffer() retorna Promise<Buffer> (sem callback)
  const pdf = pdfmake.createPdf(docDefinition)
  return pdf.getBuffer()
}
