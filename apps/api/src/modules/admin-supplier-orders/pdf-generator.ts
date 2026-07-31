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
  /** Turno do pedido (ex.: "Manhã"). Ausente em pedido de reposição (RESTOCK). */
  slotLabel?: string
  /**
   * Regime de compra (D-9). `RESTOCK` muda o título do documento e **omite a linha de pães**:
   * uma compra de geleia com "Paes: 0" no cabeçalho faz o fornecedor duvidar do pedido.
   */
  kind?: 'DELIVERY_BATCH' | 'RESTOCK'
  /**
   * Fornecedor DESTINATÁRIO. Presente → documento enviável (só as linhas dele).
   * Ausente → consolidado interno do admin, com todos os fornecedores.
   */
  supplier?: { name: string; cnpj: string }
  items: Array<{
    /** Nome do fornecedor */
    supplier: string
    /** Nome do produto (ex.: "Pão Francês", "Bolo de Fubá") */
    product: string
    /** Quantidade de unidades do produto */
    quantity: number
    /** Preço unitário em R$ */
    unitPrice: number
    /** Total (quantity * unitPrice) */
    total: number
  }>
  /** Total geral de UNIDADES (todos os produtos) */
  grandTotal: number
  /** Total só de PÃES — mantido separado dos outros produtos (D-1) */
  breadTotal?: number
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
  // Documento por fornecedor: a coluna "Fornecedor" some (ele já é o destinatário no cabeçalho) e
  // o agrupamento passa a ser por PRODUTO — que é o que ele precisa separar.
  const perSupplier = !!data.supplier

  const tableBody: unknown[][] = perSupplier
    ? [
        [
          { text: 'Produto', style: 'tableHeader' },
          { text: 'Qtd', style: 'tableHeader' },
          { text: 'Custo unit.', style: 'tableHeader' },
          { text: 'Total (R$)', style: 'tableHeader' },
        ],
        ...data.items.map((item) => [
          item.product,
          item.quantity.toString(),
          `R$ ${item.unitPrice.toFixed(2)}`,
          `R$ ${item.total.toFixed(2)}`,
        ]),
        [
          { text: 'TOTAL', bold: true },
          { text: data.grandTotal.toString(), bold: true },
          '',
          { text: data.grandTotalBrl, bold: true },
        ],
      ]
    : [
        [
          { text: 'Fornecedor', style: 'tableHeader' },
          { text: 'Produto', style: 'tableHeader' },
          { text: 'Qtd', style: 'tableHeader' },
          { text: 'Custo unit.', style: 'tableHeader' },
          { text: 'Total (R$)', style: 'tableHeader' },
        ],
        ...data.items.map((item) => [
          item.supplier,
          item.product,
          item.quantity.toString(),
          `R$ ${item.unitPrice.toFixed(2)}`,
          `R$ ${item.total.toFixed(2)}`,
        ]),
        [
          { text: 'TOTAL', bold: true },
          '',
          { text: data.grandTotal.toString(), bold: true },
          '',
          { text: data.grandTotalBrl, bold: true },
        ],
      ]

  const isRestock = data.kind === 'RESTOCK'
  const subtitle = [
    `Data: ${data.date}`,
    data.slotLabel ? `Turno: ${data.slotLabel}` : '',
    !isRestock && data.breadTotal != null ? `Paes: ${data.breadTotal}` : '',
    isRestock ? 'Reposicao de estoque' : '',
  ]
    .filter(Boolean)
    .join('   |   ')

  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 11 },
    content: [
      { text: isRestock ? 'Reposicao de Estoque' : 'Pedido ao Fornecedor', style: 'header' },
      ...(perSupplier
        ? [{ text: `${data.supplier!.name}  ·  CNPJ ${data.supplier!.cnpj}`, style: 'supplier' }]
        : [{ text: 'Consolidado (uso interno)', style: 'supplier' }]),
      { text: subtitle, margin: [0, 4, 0, 16] },
      {
        table: {
          widths: perSupplier ? ['*', 'auto', 'auto', 'auto'] : ['*', '*', 'auto', 'auto', 'auto'],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      supplier: { fontSize: 12, bold: true },
      tableHeader: { bold: true, fillColor: '#f0f0f0' },
    },
  }

  // pdfmake v0.3: getBuffer() retorna Promise<Buffer> (sem callback)
  const pdf = pdfmake.createPdf(docDefinition)
  return pdf.getBuffer()
}
