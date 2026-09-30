// day-sales-pdf.ts — PDF do relatório de itens vendidos do dia.
//
// Mesma stack do pedido ao fornecedor (pdfmake v0.3, `getBuffer()`, Helvetica built-in, sem
// vfs_fonts) — ver `admin-supplier-orders/pdf-generator.ts`. O documento é INTERNO: diferente do
// pedido ao fornecedor, nunca é enviado para fora, então mostra receita sem ressalva.

import pdfmake from 'pdfmake/js/index.js'
import type { DaySales } from '../../lib/day-sales.js'
import { formatBrl, formatDayLong, formatApuradoEm } from './day-sales-format.js'

// Fontes Helvetica built-in (pdfmake v0.3 — sem vfs_fonts.js). Repetido aqui, e não importado do
// gerador do pedido ao fornecedor, porque o registro é um efeito colateral de import: depender
// dele seria depender de qual módulo alguém carregou primeiro. `addFonts` é idempotente.
pdfmake.addFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
})

/**
 * generateDaySalesPdf — Buffer PDF do relatório de um dia.
 *
 * Três blocos, na ordem em que a pergunta aparece: quanto saiu no total, o que saiu item a item,
 * e como isso se divide entre os turnos.
 */
export async function generateDaySalesPdf(report: DaySales): Promise<Buffer> {
  const { breads, items, lines, slots, counts, cash } = report

  const resumo = [
    `${breads.total} pães`,
    `${items.total} ${items.total === 1 ? 'item' : 'itens'}`,
    formatBrl(report.totalRevenue),
    `${counts.stops} ${counts.stops === 1 ? 'parada' : 'paradas'}`,
    `${counts.clients} ${counts.clients === 1 ? 'cliente' : 'clientes'}`,
  ].join('   |   ')

  const origemPao = [
    breads.single > 0 ? `avulso ${breads.single}` : '',
    breads.scheduled > 0 ? `agenda ${breads.scheduled}` : '',
    breads.fromMarket > 0 ? `Cestinha ${breads.fromMarket}` : '',
    breads.fromItems > 0 ? `item ${breads.fromItems}` : '',
  ]
    .filter(Boolean)
    .join('   ·   ')

  const linhasTabela: unknown[][] = [
    [
      { text: 'Produto', style: 'tableHeader' },
      { text: 'Qtd', style: 'tableHeader', alignment: 'right' },
      { text: 'Preço médio', style: 'tableHeader', alignment: 'right' },
      { text: 'Total', style: 'tableHeader', alignment: 'right' },
    ],
    ...lines.map((l) => [
      { text: l.name, bold: l.isBread },
      { text: String(l.qty), alignment: 'right', bold: l.isBread },
      { text: formatBrl(l.avgUnitPrice), alignment: 'right' },
      { text: formatBrl(l.revenue), alignment: 'right', bold: l.isBread },
    ]),
    [
      { text: 'TOTAL', bold: true },
      { text: String(breads.total + items.total), alignment: 'right', bold: true },
      '',
      { text: formatBrl(report.totalRevenue), alignment: 'right', bold: true },
    ],
  ]

  const tabelaTurnos: unknown[][] = [
    [
      { text: 'Turno', style: 'tableHeader' },
      { text: 'Pães', style: 'tableHeader', alignment: 'right' },
      { text: 'Itens', style: 'tableHeader', alignment: 'right' },
      { text: 'Total', style: 'tableHeader', alignment: 'right' },
    ],
    ...slots.map((s) => [
      s.label,
      { text: String(s.breads), alignment: 'right' },
      { text: String(s.items), alignment: 'right' },
      { text: formatBrl(s.revenue), alignment: 'right' },
    ]),
  ]

  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 11 },
    content: [
      { text: 'Itens vendidos', style: 'header' },
      { text: formatDayLong(report.date), style: 'subheader' },
      { text: `Apurado em ${formatApuradoEm(report.generatedAt)}`, style: 'muted', margin: [0, 2, 0, 12] },
      { text: resumo, margin: [0, 0, 0, 4] },
      ...(origemPao ? [{ text: `Pães por origem: ${origemPao}`, style: 'muted', margin: [0, 0, 0, 14] }] : [{ text: '', margin: [0, 0, 0, 10] }]),

      ...(lines.length > 0
        ? [
            {
              table: { widths: ['*', 'auto', 'auto', 'auto'], body: linhasTabela },
              layout: 'lightHorizontalLines',
            },
          ]
        : [{ text: 'Nenhuma venda registrada para este dia até o momento.', italics: true }]),

      ...(slots.length > 0
        ? [
            { text: 'Por turno', style: 'section', margin: [0, 20, 0, 6] },
            {
              table: { widths: ['*', 'auto', 'auto', 'auto'], body: tabelaTurnos },
              layout: 'lightHorizontalLines',
            },
          ]
        : []),

      {
        text: `Recebido na Cestinha: ${formatBrl(cash.money)} em dinheiro + ${(cash.creditsMilli / 1000).toFixed(1)} pãezinhos em crédito`,
        style: 'muted',
        margin: [0, 18, 0, 0],
      },
      {
        // Sem esta linha, alguém lê o total como faturamento do dia — e não é: o pão da agenda
        // foi pago em pãezinhos comprados semanas antes, num combo.
        text:
          `Os pães são valorizados a ${formatBrl(breads.unitPrice)} (preço do avulso); ` +
          'o pão da agenda foi pago em pãezinhos de combo, em outra data. ' +
          'O relatório conta o que foi VENDIDO para este dia — não o que foi entregue.',
        style: 'muted',
        margin: [0, 6, 0, 0],
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 2] },
      subheader: { fontSize: 13, bold: true },
      section: { fontSize: 13, bold: true },
      muted: { fontSize: 9, color: '#666666' },
      tableHeader: { bold: true, fillColor: '#f0f0f0' },
    },
  }

  return pdfmake.createPdf(docDefinition).getBuffer()
}
