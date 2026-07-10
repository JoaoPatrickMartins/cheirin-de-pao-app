// generators.test.ts — TDD RED: testa geradores de PDF e Excel
// Requirements: ADMO-08 — relatório PDF e Excel para download
// Verifica que generatePdf e generateExcel retornam Buffer > 100 bytes

import { describe, it, expect } from 'vitest'
import { generatePdf } from '../pdf-generator.js'
import { generateExcel } from '../excel-generator.js'
import type { SupplierOrderData } from '../pdf-generator.js'

const sampleData: SupplierOrderData = {
  date: '15/06/2026',
  items: [
    { supplier: 'Padaria Central', quantity: 50, unitPrice: 0.5, total: 25.0 },
    { supplier: 'Fornecedor Norte', quantity: 30, unitPrice: 0.6, total: 18.0 },
  ],
  grandTotal: 80,
  grandTotalBrl: 'R$ 43,00',
}

describe('generatePdf', () => {
  it('retorna Buffer maior que 100 bytes para input valido', async () => {
    const buf = await generatePdf(sampleData)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('retorna Buffer para data com apenas um item', async () => {
    const singleItem: SupplierOrderData = {
      date: '15/06/2026',
      items: [{ supplier: 'Fornecedor Unico', quantity: 100, unitPrice: 0.5, total: 50.0 }],
      grandTotal: 100,
      grandTotalBrl: 'R$ 50,00',
    }
    const buf = await generatePdf(singleItem)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })
})

describe('generateExcel', () => {
  it('retorna Buffer maior que 100 bytes para input valido', async () => {
    const buf = await generateExcel(sampleData)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('retorna Buffer para data com apenas um item', async () => {
    const singleItem: SupplierOrderData = {
      date: '15/06/2026',
      items: [{ supplier: 'Fornecedor Unico', quantity: 100, unitPrice: 0.5, total: 50.0 }],
      grandTotal: 100,
      grandTotalBrl: 'R$ 50,00',
    }
    const buf = await generateExcel(singleItem)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })
})
