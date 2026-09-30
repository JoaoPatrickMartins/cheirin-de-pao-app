/**
 * xlsx — geração e download de planilha no cliente.
 *
 * Substitui o CSV em todas as telas de relatório. O motivo é o que acontece DEPOIS do download:
 * quem baixa um relatório vai somar, filtrar e montar tabela dinâmica em cima dele. O CSV
 * entregava tudo como texto — `12,50` colado numa célula pt-BR às vezes vira número, às vezes
 * vira string, e a coluna não soma. Aqui **número é número**, com formato de moeda/percentual
 * aplicado na célula, e o arquivo abre com as colunas já dimensionadas.
 *
 * **`exceljs` é carregado sob demanda** (`await import`), e isso não é detalhe de performance: é
 * um PWA que o cliente comum abre no celular para comprar pão. O escritor de planilha só interessa
 * ao admin, no momento em que ele toca em exportar — o Vite o separa num chunk próprio e o bundle
 * de quem nunca exporta nada não cresce um byte.
 *
 * A biblioteca é a MESMA que a API já usa em `day-sales-excel.ts`. Uma só gramática de planilha
 * nos dois lados; sem isso, o arquivo baixado da tela e o baixado do servidor sairiam com cara
 * diferente no primeiro ajuste.
 */

/** Uma célula: texto, número ou vazio. Número vai como NÚMERO — nunca como texto formatado. */
export type XlsxCell = string | number | null | undefined

export interface XlsxSheet {
  /** Nome da aba. Sanitizado: o Excel recusa `[]:*?/\` e nomes acima de 31 caracteres. */
  name: string
  head: string[]
  rows: XlsxCell[][]
  /**
   * Índices (0-based) das colunas em R$. A coluna sai com `R$ #,##0.00` — a célula guarda
   * `12.5` e o Excel exibe `R$ 12,50`, então ela soma.
   */
  money?: number[]
  /**
   * Índices (0-based) das colunas em percentual. O valor esperado é a TAXA (0..1), não o número
   * já multiplicado: `0.123` exibido como `12,3%`. Mandar `12.3` aqui renderiza `1230,0%`.
   */
  percent?: number[]
  /** Índices (0-based) das colunas de inteiro (sem casas decimais). */
  integer?: number[]
  /** Linhas livres ACIMA do cabeçalho: título, período apurado, regime. */
  notes?: string[]
  /**
   * Rodapé — a procedência do número. É onde vão as ressalvas que a tela exibe (base de cálculo,
   * número parcial, regime). Uma planilha que sai sem elas vira "o número oficial" na mão de quem
   * a recebeu por e-mail.
   */
  footer?: string[]
}

const BRL_FORMAT = 'R$ #,##0.00'
const PCT_FORMAT = '0.0%'
const INT_FORMAT = '#,##0'

/** O Excel recusa `[]:*?/\` no nome da aba e trunca em 31 caracteres. */
function sheetName(name: string, index: number): string {
  const clean = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return clean === '' ? `Planilha ${index + 1}` : clean
}

/** Largura da coluna pelo conteúdo mais longo, com teto — coluna de 200 chars é ilegível. */
function columnWidth(head: string, rows: XlsxCell[][], col: number): number {
  let max = head.length
  for (const r of rows) {
    const v = r[col]
    const len = v == null ? 0 : String(v).length
    if (len > max) max = len
  }
  return Math.min(Math.max(max + 2, 10), 44)
}

/**
 * Monta a pasta de trabalho. Separada do download porque é AQUI que mora a aritmética que pode
 * errar — o deslocamento das linhas quando existem notas acima do cabeçalho —, e isso precisa ser
 * testável sem `URL.createObjectURL`, que o jsdom não implementa.
 */
export async function buildWorkbook(sheets: XlsxSheet[]) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Cheirin de Pão'
  workbook.created = new Date()

  sheets.forEach((s, index) => {
    const ws = workbook.addWorksheet(sheetName(s.name, index))

    // As notas vêm antes de tudo, então o cabeçalho NÃO está na linha 1. É por isso que as linhas
    // são acrescentadas em ordem (em vez de `ws.columns = [...]`, que crava o header na 1) e que
    // todo índice de formato abaixo é relativo a `headerRow.number`.
    for (const note of s.notes ?? []) ws.addRow([note])
    if ((s.notes?.length ?? 0) > 0) {
      ws.getRow(1).font = { bold: true, size: 13 }
      ws.addRow([])
    }

    const headerRow = ws.addRow(s.head)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }

    for (const row of s.rows) ws.addRow(row)

    const firstDataRow = headerRow.number + 1
    const lastDataRow = headerRow.number + s.rows.length
    const applyFormat = (cols: number[] | undefined, numFmt: string) => {
      for (const c of cols ?? []) {
        for (let r = firstDataRow; r <= lastDataRow; r++) {
          ws.getRow(r).getCell(c + 1).numFmt = numFmt
        }
      }
    }
    applyFormat(s.money, BRL_FORMAT)
    applyFormat(s.percent, PCT_FORMAT)
    applyFormat(s.integer, INT_FORMAT)

    s.head.forEach((h, c) => {
      ws.getColumn(c + 1).width = columnWidth(h, s.rows, c)
    })

    // Congela o cabeçalho: relatório de 300 linhas rolado sem isso perde a referência da coluna.
    ws.views = [{ state: 'frozen', ySplit: headerRow.number }]

    if ((s.footer?.length ?? 0) > 0) {
      ws.addRow([])
      for (const line of s.footer ?? []) ws.addRow([line])
    }
  })

  return workbook
}

/**
 * downloadXlsx — monta o arquivo e dispara o download.
 *
 * Falha em silêncio, como o CSV fazia: exportar é ação acessória, e derrubar a tela de relatório
 * porque o download não pôde ser iniciado seria o pior desfecho possível.
 */
export async function downloadXlsx(filename: string, sheets: XlsxSheet[]): Promise<void> {
  try {
    const workbook = await buildWorkbook(sheets)
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    /* download indisponível — ignora silenciosamente, como o CSV fazia */
  }
}
