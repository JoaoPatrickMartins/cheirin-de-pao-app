// accountant-package.service.test.ts — o pacote do contador (D3).
//
// Este ZIP SAI DA EMPRESA, então o teste não se contenta em verificar que o serviço não estourou:
// ele **abre o arquivo gerado** e confere o que tem dentro. Um ZIP corrompido ou sem o razão só
// apareceria na mão do contador.
//
// E trava a decisão central: **comprovante que falha não some em silêncio** — entra no manifesto
// com o motivo e a URL, senão o contador não tem como saber o que pedir de volta.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'

import { AccountantPackageService } from '../accountant-package.service.js'
import { DreService } from '../dre.service.js'

const dreStub = (closedAt?: string) =>
  ({
    regime: 'cash',
    closedAt,
    dre: {
      window: { label: 'agosto de 2026', isPartial: false },
      grossRevenue: 10000,
      netRevenue: 9500,
      grossProfit: 6000,
      ebitda: 3000,
      netProfit: 2500,
      grossMarginPct: 63.2,
      operatingMarginPct: 31.6,
      netMarginPct: 26.3,
      caveats: ['CMV do pão = custo comprado no período.'],
      sections: [
        { key: 'rev', label: 'RECEITA BRUTA', total: 10000, lines: [{ key: 'c', label: 'Combos', value: 8000 }] },
      ],
    },
    alternate: {
      window: { label: 'agosto de 2026', isPartial: false },
      grossRevenue: 9000,
      netRevenue: 8500,
      grossProfit: 5000,
      ebitda: 2000,
      netProfit: 1500,
      grossMarginPct: 58.8,
      operatingMarginPct: 23.5,
      netMarginPct: 17.6,
      caveats: [],
      sections: [],
    },
    bridge: { cashResult: 2500, accrualResult: 1500, difference: 1000, lines: [] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

const expense = (o: Record<string, unknown> = {}) => ({
  id: 'e1',
  categoryId: 'cat1',
  description: 'Combustível da moto',
  amount: 180.5,
  competenceDate: new Date('2026-08-12T03:00:00Z'),
  dueDate: null,
  paidAt: new Date('2026-08-12T03:00:00Z'),
  status: 'PAID',
  payee: 'Posto X',
  paymentMethod: 'Pix',
  receiptUrl: null,
  ...o,
})

function makePrisma(expenses: Record<string, unknown>[] = []) {
  return {
    expense: { findMany: vi.fn().mockResolvedValue(expenses) },
    expenseCategory: {
      findMany: vi.fn().mockResolvedValue([{ id: 'cat1', name: 'Combustível', group: 'OPERATION' }]),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const makeService = (prisma: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new AccountantPackageService({ prisma, log: { warn: vi.fn() } } as any)

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AccountantPackageService.build', () => {
  it('gera um ZIP que ABRE, com os dois DREs, o razão e o manifesto', async () => {
    const { buffer, filename } = await makeService(makePrisma([expense()])).build('2026-08')

    expect(filename).toBe('contador-2026-08.zip')
    const zip = await JSZip.loadAsync(buffer)
    const names = Object.keys(zip.files)

    expect(names).toContain('DRE-2026-08-caixa.pdf')
    expect(names).toContain('DRE-2026-08-competencia.pdf')
    expect(names).toContain('razao-despesas-2026-08.xlsx')
    expect(names).toContain('MANIFESTO.txt')
  })

  it('o PDF gerado é um PDF de verdade', async () => {
    const { buffer } = await makeService(makePrisma()).build('2026-08')
    const zip = await JSZip.loadAsync(buffer)
    const pdf = await zip.file('DRE-2026-08-caixa.pdf')!.async('uint8array')
    // "%PDF" — sem isso nenhum leitor abre.
    expect(Array.from(pdf.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
  })

  it('o razão é um XLSX de verdade e traz o lançamento', async () => {
    const { buffer } = await makeService(makePrisma([expense()])).build('2026-08')
    const zip = await JSZip.loadAsync(buffer)
    const xlsx = await zip.file('razao-despesas-2026-08.xlsx')!.async('uint8array')
    expect(Array.from(xlsx.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(xlsx.byteLength).toBeGreaterThan(1000)
  })

  it('avisa no manifesto quando o mês NÃO está fechado', async () => {
    const { buffer } = await makeService(makePrisma()).build('2026-08')
    const zip = await JSZip.loadAsync(buffer)
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/NÃO fechado/)
  })

  it('carimba o fechamento no manifesto quando o mês está fechado', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(
      dreStub('2026-09-01T10:00:00.000Z'),
    )
    const { buffer } = await makeService(makePrisma()).build('2026-08')
    const zip = await JSZip.loadAsync(buffer)
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/FECHADO em/)
    expect(manifest).toMatch(/congelados/)
  })

  it('anexa o comprovante baixado e o registra como OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '1024' },
        arrayBuffer: async () => new ArrayBuffer(1024),
      }),
    )
    const { buffer } = await makeService(
      makePrisma([expense({ receiptUrl: 'https://s3/receipts/abc.jpg' })]),
    ).build('2026-08')

    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files)).toContain('comprovantes/e1.jpg')
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/\[OK\]\s+e1\.jpg/)
  })

  it('comprovante que FALHA não some — vai ao manifesto com motivo e URL', async () => {
    // Um ZIP com 11 de 14 anexos e sem lista deixa o contador sem saber o que pedir de volta.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } }))
    const { buffer } = await makeService(
      makePrisma([expense({ receiptUrl: 'https://s3/receipts/sumiu.pdf' })]),
    ).build('2026-08')

    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files)).not.toContain('comprovantes/e1.pdf')
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/\[FALHA\]/)
    expect(manifest).toMatch(/HTTP 404/)
    expect(manifest).toMatch(/https:\/\/s3\/receipts\/sumiu\.pdf/)
    expect(manifest).toMatch(/1 não baixado/)
  })

  it('erro de rede no comprovante não derruba o pacote', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    const { buffer } = await makeService(
      makePrisma([expense({ receiptUrl: 'https://s3/receipts/x.png' })]),
    ).build('2026-08')

    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files)).toContain('razao-despesas-2026-08.xlsx')
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/ECONNRESET/)
  })

  it('recusa comprovante grande demais, dizendo por quê', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, headers: { get: () => String(50 * 1024 * 1024) } }),
    )
    const { buffer } = await makeService(
      makePrisma([expense({ receiptUrl: 'https://s3/receipts/enorme.pdf' })]),
    ).build('2026-08')

    const zip = await JSZip.loadAsync(buffer)
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/grande demais/)
  })

  it('diz no manifesto quando nenhum lançamento tem comprovante', async () => {
    const { buffer } = await makeService(makePrisma([expense()])).build('2026-08')
    const zip = await JSZip.loadAsync(buffer)
    const manifest = await zip.file('MANIFESTO.txt')!.async('string')
    expect(manifest).toMatch(/nenhum lançamento do mês tem comprovante/)
  })

  it('recusa mês fora do formato', async () => {
    await expect(makeService(makePrisma()).build('ago/2026')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('apura as despesas por COMPETÊNCIA e ignora a cancelada', async () => {
    const prisma = makePrisma()
    await makeService(prisma).build('2026-08')
    const where = prisma.expense.findMany.mock.calls[0][0].where
    expect(where).toHaveProperty('competenceDate')
    expect(where.status.in).toEqual(['PENDING', 'PAID'])
  })
})
