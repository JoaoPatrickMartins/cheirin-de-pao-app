// dre-pdf.ts — a Demonstração do Resultado em PDF (D3 · pacote do contador).
//
// Mesma stack de `day-sales-pdf.ts`: pdfmake v0.3, `getBuffer()`, Helvetica built-in, sem
// vfs_fonts.
//
// Diferente dos outros PDFs do projeto, este documento **sai da empresa** — vai para o contador.
// Duas consequências de projeto:
//
//   1. **O regime é declarado no cabeçalho**, sempre. Caixa e competência dão números muito
//      diferentes num modelo pré-pago, e um DRE que não diz qual usou mente por omissão.
//   2. **As ressalvas são impressas**, não omitidas. O CMV do pão é custo COMPRADO no período, e
//      quem receber a folha sem essa nota vai supor que é custo do que foi vendido.

import pdfmake from 'pdfmake/js/index.js'
import type { DreResult, DreRegime } from '../../lib/dre.js'

pdfmake.addFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
})

const REGIME_LABEL: Record<DreRegime, string> = {
  cash: 'Caixa',
  accrual: 'Competência',
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

/** Uma linha de total, em negrito e com a margem ao lado quando ela existe. */
function totalRow(label: string, value: number, pct?: number) {
  return [
    { text: label, bold: true, fontSize: 10 },
    { text: brl(value), bold: true, alignment: 'right' as const, fontSize: 10 },
    { text: pct != null ? `${pct.toFixed(1)}%` : '', alignment: 'right' as const, fontSize: 9 },
  ]
}

export interface DrePdfOptions {
  /** Instante do fechamento, quando o mês está fechado. Vira o carimbo de "número congelado". */
  closedAt?: string
}

/** generateDrePdf — Buffer PDF do DRE de um período. */
export async function generateDrePdf(
  dre: DreResult,
  regime: DreRegime,
  options: DrePdfOptions = {},
): Promise<Buffer> {
  const body: unknown[][] = [
    [
      { text: 'Linha', bold: true, fontSize: 9 },
      { text: 'Valor', bold: true, alignment: 'right', fontSize: 9 },
      { text: '%', bold: true, alignment: 'right', fontSize: 9 },
    ],
  ]

  for (const section of dre.sections) {
    body.push([
      { text: section.label, bold: true, fontSize: 9.5, margin: [0, 4, 0, 0] },
      { text: '', alignment: 'right' },
      { text: '' },
    ])
    for (const line of section.lines) {
      body.push([
        { text: `    ${line.label}`, fontSize: 9 },
        {
          text: brl(line.isNegative ? -line.value : line.value),
          alignment: 'right',
          fontSize: 9,
        },
        { text: '' },
      ])
    }
  }

  body.push(totalRow('RECEITA BRUTA', dre.grossRevenue))
  body.push(totalRow('RECEITA LÍQUIDA', dre.netRevenue))
  body.push(totalRow('LUCRO BRUTO', dre.grossProfit, dre.grossMarginPct))
  body.push(totalRow('EBITDA', dre.ebitda, dre.operatingMarginPct))
  body.push(totalRow('LUCRO LÍQUIDO', dre.netProfit, dre.netMarginPct))

  const doc = {
    pageSize: 'A4',
    pageMargins: [36, 40, 36, 44] as [number, number, number, number],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      { text: 'Demonstração do Resultado', fontSize: 16, bold: true },
      {
        text: `${dre.window.label}  ·  regime de ${REGIME_LABEL[regime]}`,
        fontSize: 10,
        margin: [0, 3, 0, 0] as [number, number, number, number],
      },
      options.closedAt
        ? {
            text: `Mês FECHADO em ${new Date(options.closedAt).toLocaleDateString('pt-BR')} — números congelados.`,
            fontSize: 8.5,
            italics: true,
            margin: [0, 3, 0, 0] as [number, number, number, number],
          }
        : {
            text: dre.window.isPartial
              ? 'ATENÇÃO: período EM CURSO — não é um fechamento.'
              : 'Mês não fechado — os números ainda podem mudar se um custo de fornecimento for reajustado.',
            fontSize: 8.5,
            italics: true,
            margin: [0, 3, 0, 0] as [number, number, number, number],
          },
      {
        table: { widths: ['*', 80, 45], body },
        layout: 'lightHorizontalLines',
        margin: [0, 12, 0, 0] as [number, number, number, number],
      },
      dre.caveats.length > 0
        ? {
            text: 'Notas',
            bold: true,
            fontSize: 9.5,
            margin: [0, 16, 0, 4] as [number, number, number, number],
          }
        : {},
      // As ressalvas são IMPRESSAS. Este documento sai da empresa, e o leitor não tem a tela ao
      // lado para descobrir em que base cada linha foi apurada.
      ...dre.caveats.map((c) => ({
        text: `• ${c}`,
        fontSize: 8,
        margin: [0, 1, 0, 0] as [number, number, number, number],
      })),
    ],
    footer: (page: number, total: number) => ({
      text: `${page} / ${total}`,
      alignment: 'center' as const,
      fontSize: 8,
      margin: [0, 12, 0, 0] as [number, number, number, number],
    }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdfmake.createPdf(doc as any).getBuffer() as Promise<Buffer>
}
