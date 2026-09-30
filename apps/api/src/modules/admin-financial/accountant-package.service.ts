/**
 * accountant-package.service — o pacote do contador (D3).
 *
 * Um ZIP mensal com o que o contador pede todo mês e que hoje o dono monta à mão: o DRE em PDF, o
 * razão de despesas em XLSX e os comprovantes anexados.
 *
 * ## Comprovante que falha não some em silêncio
 *
 * Os comprovantes vivem no S3 e são baixados um a um. Rede falha, arquivo é removido, URL expira —
 * e um ZIP com 11 de 14 comprovantes, sem dizer quais faltaram, é pior que nenhum ZIP: o contador
 * não tem como saber o que pedir de volta. Por isso todo lançamento com comprovante entra no
 * `MANIFESTO.txt` com o status do download e a URL de origem. O pacote pode vir incompleto; ele
 * nunca vem incompleto **em silêncio**.
 *
 * ## Só mês fechado sai completo
 *
 * O pacote de um mês em curso é gerado (o contador às vezes pede prévia), mas o PDF carrega o aviso
 * de período em curso e o manifesto repete. O que não pode acontecer é uma prévia chegar ao
 * contador com cara de fechamento.
 */
import { FastifyInstance } from 'fastify'
// `archiver` é CommonJS com `export =`. O namespace import dá os TIPOS; a fábrica em si vem do
// mesmo objeto (direto ou sob `.default`, conforme o interop). O cast isola essa bagunça num ponto
// só, em vez de espalhar `any` pelo arquivo.
import * as archiverNs from 'archiver'

type ArchiverFactory = (format: string, options?: archiverNs.ArchiverOptions) => archiverNs.Archiver
const archiver = ((archiverNs as unknown as { default?: ArchiverFactory }).default ??
  (archiverNs as unknown as ArchiverFactory)) as ArchiverFactory
import ExcelJS from 'exceljs'
import type { ExpenseStatus } from '@prisma/client'
import { monthWindow, MONTH_RE } from '../../lib/date-range.js'
import { DreService } from './dre.service.js'
import { generateDrePdf } from './dre-pdf.js'

const BRL_FORMAT = 'R$ #,##0.00'
/** Teto por comprovante. Acima disso o arquivo entra só no manifesto, com o motivo. */
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024
/** Tempo máximo esperando um comprovante. Um S3 lento não pode travar o pacote inteiro. */
const RECEIPT_TIMEOUT_MS = 15_000

const dayBrt = (at: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(at)

export class AccountantPackageService {
  private dre: DreService

  constructor(private fastify: FastifyInstance) {
    this.dre = new DreService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /** Monta o ZIP do mês. Devolve o buffer e o nome sugerido do arquivo. */
  async build(month: string): Promise<{ buffer: Buffer; filename: string }> {
    if (!MONTH_RE.test(month)) {
      throw { statusCode: 400, message: 'month deve estar no formato YYYY-MM' }
    }

    const win = monthWindow(month)
    const [dre, expenses] = await Promise.all([
      this.dre.getDre(win, 'cash'),
      this.monthExpenses(win),
    ])

    const [pdfCash, pdfAccrual, ledger] = await Promise.all([
      generateDrePdf(dre.dre, 'cash', { closedAt: dre.closedAt }),
      generateDrePdf(dre.alternate, 'accrual', { closedAt: dre.closedAt }),
      this.buildLedger(month, expenses),
    ])

    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    archive.on('data', (c: Buffer) => chunks.push(c))
    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', resolve)
      archive.on('error', reject)
    })

    archive.append(pdfCash, { name: `DRE-${month}-caixa.pdf` })
    archive.append(pdfAccrual, { name: `DRE-${month}-competencia.pdf` })
    archive.append(ledger, { name: `razao-despesas-${month}.xlsx` })

    const manifest = await this.appendReceipts(archive, expenses, month, dre.closedAt)
    archive.append(Buffer.from(manifest, 'utf-8'), { name: 'MANIFESTO.txt' })

    await archive.finalize()
    await done

    return { buffer: Buffer.concat(chunks), filename: `contador-${month}.zip` }
  }

  /** Despesas do mês por COMPETÊNCIA — a mesma base do DRE de competência e do relatório. */
  private async monthExpenses(win: { startDate: Date; endDate: Date }) {
    const rows = await this.prisma.expense.findMany({
      where: {
        status: { in: ['PENDING', 'PAID'] as ExpenseStatus[] },
        competenceDate: { gte: win.startDate, lt: win.endDate },
      },
      orderBy: { competenceDate: 'asc' },
    })
    if (rows.length === 0) return []

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.categoryId))] } },
      select: { id: true, name: true, group: true },
    })
    const byId = new Map(categories.map((c) => [c.id, c]))

    return rows.map((r) => ({
      ...r,
      categoryName: byId.get(r.categoryId)?.name ?? 'Categoria removida',
      categoryGroup: (byId.get(r.categoryId)?.group as string) ?? 'OTHER',
    }))
  }

  /** O razão: um lançamento por linha, com a referência do comprovante no próprio razão. */
  private async buildLedger(
    month: string,
    expenses: Awaited<ReturnType<AccountantPackageService['monthExpenses']>>,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Cheirin de Pão'
    wb.created = new Date()

    const ws = wb.addWorksheet('Razão de despesas')
    ws.addRow([`Razão de despesas — ${month}`])
    ws.getRow(1).font = { bold: true, size: 13 }
    ws.addRow(['Apurado por COMPETÊNCIA. Despesas canceladas ficam de fora.'])
    ws.addRow([])

    const header = ws.addRow([
      'Competência',
      'Vencimento',
      'Pagamento',
      'Grupo do DRE',
      'Categoria',
      'Descrição',
      'Recebedor',
      'Forma',
      'Situação',
      'Valor',
      'Comprovante',
    ])
    header.font = { bold: true }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }

    for (const e of expenses) {
      ws.addRow([
        dayBrt(e.competenceDate),
        e.dueDate ? dayBrt(e.dueDate) : '',
        e.paidAt ? dayBrt(e.paidAt) : '',
        e.categoryGroup,
        e.categoryName,
        e.description,
        e.payee ?? '',
        e.paymentMethod ?? '',
        e.status === 'PAID' ? 'Paga' : 'A pagar',
        e.amount,
        // O nome do arquivo no ZIP, para o contador cruzar razão × pasta sem adivinhar.
        e.receiptUrl ? this.receiptName(e.id, e.receiptUrl) : '',
      ])
    }

    const total = ws.addRow([
      'TOTAL',
      '', '', '', '', '', '', '', '',
      expenses.reduce((s, e) => s + e.amount, 0),
      '',
    ])
    total.font = { bold: true }

    ws.getColumn(10).numFmt = BRL_FORMAT
    ws.columns.forEach((c, i) => {
      c.width = i === 5 ? 34 : i === 10 ? 30 : 16
    })
    ws.views = [{ state: 'frozen', ySplit: header.number }]

    return (await wb.xlsx.writeBuffer()) as Buffer
  }

  /**
   * Baixa os comprovantes para `comprovantes/` e devolve o texto do manifesto.
   *
   * Sequencial de propósito: baixar 60 anexos em paralelo do S3 num container pequeno é o tipo de
   * pico que derruba o processo inteiro por causa de um relatório mensal.
   */
  private async appendReceipts(
    archive: archiverNs.Archiver,
    expenses: Awaited<ReturnType<AccountantPackageService['monthExpenses']>>,
    month: string,
    closedAt?: string,
  ): Promise<string> {
    const lines: string[] = [
      `PACOTE DO CONTADOR — ${month}`,
      `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      closedAt
        ? `Mês FECHADO em ${new Date(closedAt).toLocaleDateString('pt-BR')} — os números do DRE estão congelados.`
        : 'Mês NÃO fechado — os números do DRE ainda podem mudar. Feche o mês em Financeiro › DRE antes de considerá-lo definitivo.',
      '',
      'CONTEÚDO',
      `  DRE-${month}-caixa.pdf          — regime de caixa (padrão da casa)`,
      `  DRE-${month}-competencia.pdf    — regime de competência`,
      `  razao-despesas-${month}.xlsx    — lançamento a lançamento, por competência`,
      '  comprovantes/                   — anexos dos lançamentos',
      '',
      'COMPROVANTES',
    ]

    const withReceipt = expenses.filter((e) => e.receiptUrl)
    if (withReceipt.length === 0) {
      lines.push('  (nenhum lançamento do mês tem comprovante anexado)')
      return lines.join('\n')
    }

    let ok = 0
    let failed = 0
    for (const e of withReceipt) {
      const name = this.receiptName(e.id, e.receiptUrl as string)
      const result = await this.fetchReceipt(e.receiptUrl as string)
      if (result.buffer) {
        archive.append(result.buffer, { name: `comprovantes/${name}` })
        ok += 1
        lines.push(`  [OK]    ${name}  —  ${e.description} (${e.amount.toFixed(2)})`)
      } else {
        failed += 1
        // Falhou: a linha registra o motivo E a URL, para o comprovante ser recuperado à mão.
        lines.push(
          `  [FALHA] ${name}  —  ${e.description} (${e.amount.toFixed(2)})  —  ${result.reason}`,
        )
        lines.push(`          origem: ${e.receiptUrl}`)
      }
    }

    lines.push('')
    lines.push(`  ${ok} anexado(s), ${failed} não baixado(s) de ${withReceipt.length}.`)
    if (failed > 0) {
      lines.push('  Os que falharam estão listados acima com a URL de origem — baixe-os à mão.')
    }
    return lines.join('\n')
  }

  /** Nome estável do arquivo no ZIP: id do lançamento + extensão original. */
  private receiptName(expenseId: string, url: string): string {
    const clean = url.split('?')[0]
    const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.')) : '.bin'
    // Extensão longa demais quase certamente não é extensão — é parte do caminho.
    return `${expenseId}${ext.length <= 6 ? ext : '.bin'}`
  }

  /** Baixa um comprovante com teto de tamanho e de tempo. Nunca lança. */
  private async fetchReceipt(url: string): Promise<{ buffer?: Buffer; reason: string }> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), RECEIPT_TIMEOUT_MS)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) return { reason: `HTTP ${res.status}` }

      const declared = Number(res.headers.get('content-length') ?? 0)
      if (declared > MAX_RECEIPT_BYTES) {
        return { reason: `arquivo grande demais (${Math.round(declared / 1024 / 1024)} MB)` }
      }

      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.byteLength > MAX_RECEIPT_BYTES) {
        return { reason: `arquivo grande demais (${Math.round(buffer.byteLength / 1024 / 1024)} MB)` }
      }
      return { buffer, reason: 'ok' }
    } catch (err) {
      this.fastify.log.warn({ err, url }, '[accountant-package] comprovante não baixado')
      return { reason: err instanceof Error ? err.message : 'falha ao baixar' }
    }
  }
}
