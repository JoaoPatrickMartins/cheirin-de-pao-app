// generators.test.ts — TDD RED: testa geradores de PDF e Excel
// Requirements: ADMO-08 — relatório PDF e Excel para download
// Verifica que generatePdf e generateExcel retornam Buffer > 100 bytes

import { describe, it, expect } from 'vitest'
import { generatePdf } from '../pdf-generator.js'
import { generateExcel } from '../excel-generator.js'
import type { SupplierOrderData } from '../pdf-generator.js'

// Consolidado interno (sem `supplier`): mostra a coluna Fornecedor com todos.
const sampleData: SupplierOrderData = {
  date: '15/06/2026',
  slotLabel: 'Manhã',
  items: [
    { supplier: 'Padaria Central', product: 'Pão Francês', quantity: 50, unitPrice: 0.5, total: 25.0 },
    { supplier: 'Fornecedor Norte', product: 'Bolo de Fubá', quantity: 30, unitPrice: 0.6, total: 18.0 },
  ],
  grandTotal: 80,
  breadTotal: 50,
  grandTotalBrl: 'R$ 43,00',
}

// Documento ENVIÁVEL (com `supplier`): sem a coluna Fornecedor, agrupado por produto.
const perSupplierData: SupplierOrderData = {
  date: '15/06/2026',
  slotLabel: 'Manhã',
  supplier: { name: 'Padaria Central', cnpj: '12.345.678/0001-90' },
  items: [
    { supplier: 'Padaria Central', product: 'Pão Francês', quantity: 50, unitPrice: 0.5, total: 25.0 },
    { supplier: 'Padaria Central', product: 'Bolo de Fubá', quantity: 8, unitPrice: 4.0, total: 32.0 },
  ],
  grandTotal: 58,
  breadTotal: 50,
  grandTotalBrl: 'R$ 57,00',
}

const singleItem: SupplierOrderData = {
  date: '15/06/2026',
  items: [{ supplier: 'Fornecedor Unico', product: 'Pão Francês', quantity: 100, unitPrice: 0.5, total: 50.0 }],
  grandTotal: 100,
  breadTotal: 100,
  grandTotalBrl: 'R$ 50,00',
}

describe('generatePdf', () => {
  it('retorna Buffer maior que 100 bytes para input valido', async () => {
    const buf = await generatePdf(sampleData)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('retorna Buffer para data com apenas um item', async () => {
    const buf = await generatePdf(singleItem)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('gera o documento por fornecedor (com destinatário e vários produtos)', async () => {
    const buf = await generatePdf(perSupplierData)
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
    const buf = await generateExcel(singleItem)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('gera a planilha por fornecedor (com destinatário e vários produtos)', async () => {
    const buf = await generateExcel(perSupplierData)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })
})
