// gateway-fee — a taxa retida pelo provedor (Fase 3 do plano-financeiro-vendas).
//
// O que estes testes protegem:
//   1. Taxa REAL só conta com `feeBasis: 'GATEWAY'` — número de procedência desconhecida não vira
//      verdade.
//   2. A estimativa funciona retroativamente e NUNCA é persistida.
//   3. Alíquota corrompida no banco cai no padrão em vez de virar NaN (que se propagaria por todo
//      o DRE e apareceria como "NaN" na tela).
//   4. `extractMercadoPagoFee` soma só o que o VENDEDOR paga.
//   5. `recordGatewayFee` rejeita dado corrompido do provedor.
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  loadFeeRates,
  resolveFee,
  summarizeFees,
  recordGatewayFee,
  extractMercadoPagoFee,
  DEFAULT_FEE_PCT,
  FEE_SETTING_KEYS,
} from '../gateway-fee.js'

const rates = { pct: { PIX: 1, CREDIT_CARD: 5, DEBIT_CARD: 2 } } as const

function makePrisma(settings: Array<{ key: string; value: string }> = []) {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = []
  const prisma = {
    setting: { findMany: vi.fn().mockResolvedValue(settings) },
    payment: {
      update: vi.fn().mockImplementation((args) => {
        updates.push(args)
        return Promise.resolve({})
      }),
    },
  } as unknown as PrismaClient
  return { prisma, updates }
}

describe('loadFeeRates', () => {
  it('lê as alíquotas configuradas', async () => {
    const { prisma } = makePrisma([
      { key: FEE_SETTING_KEYS.PIX, value: '0.79' },
      { key: FEE_SETTING_KEYS.CREDIT_CARD, value: '3.99' },
    ])
    const r = await loadFeeRates(prisma)

    expect(r.pct.PIX).toBe(0.79)
    expect(r.pct.CREDIT_CARD).toBe(3.99)
    // Não configurada cai no padrão.
    expect(r.pct.DEBIT_CARD).toBe(DEFAULT_FEE_PCT.DEBIT_CARD)
  })

  it('banco vazio usa os padrões — a linha do DRE nunca fica em branco', async () => {
    const { prisma } = makePrisma([])
    expect((await loadFeeRates(prisma)).pct).toEqual(DEFAULT_FEE_PCT)
  })

  it('valor corrompido cai no padrão em vez de virar NaN', async () => {
    // Um NaN aqui se propagaria por toda a soma e o total do DRE apareceria como "NaN".
    for (const bad of ['abc', '', '-5', '150']) {
      const { prisma } = makePrisma([{ key: FEE_SETTING_KEYS.PIX, value: bad }])
      const r = await loadFeeRates(prisma)
      expect(Number.isFinite(r.pct.PIX)).toBe(true)
      expect(r.pct.PIX).toBe(DEFAULT_FEE_PCT.PIX)
    }
  })

  it('aceita alíquota zero (conta sem taxa negociada)', async () => {
    const { prisma } = makePrisma([{ key: FEE_SETTING_KEYS.PIX, value: '0' }])
    expect((await loadFeeRates(prisma)).pct.PIX).toBe(0)
  })
})

describe('resolveFee — real × estimada', () => {
  it('usa a taxa REAL quando o provedor informou', () => {
    const r = resolveFee(
      { amount: 100, method: 'PIX', gatewayFee: 0.87, feeBasis: 'GATEWAY' },
      rates,
    )
    expect(r).toEqual({ fee: 0.87, net: 99.13, basis: 'GATEWAY' })
  })

  it('estima quando não há taxa gravada', () => {
    const r = resolveFee({ amount: 100, method: 'PIX' }, rates)
    expect(r).toEqual({ fee: 1, net: 99, basis: 'ESTIMATED' })
  })

  it('gatewayFee SEM feeBasis não é tratado como real', () => {
    // Número de procedência desconhecida: tratá-lo como real esconderia o problema.
    const r = resolveFee({ amount: 100, method: 'PIX', gatewayFee: 99 }, rates)
    expect(r.basis).toBe('ESTIMATED')
    expect(r.fee).toBe(1)
  })

  it('aplica a alíquota do método certo', () => {
    expect(resolveFee({ amount: 200, method: 'CREDIT_CARD' }, rates).fee).toBe(10)
    expect(resolveFee({ amount: 200, method: 'DEBIT_CARD' }, rates).fee).toBe(4)
  })

  it('arredonda a centavos', () => {
    // 33.33 × 1% = 0.3333 → 0.33
    expect(resolveFee({ amount: 33.33, method: 'PIX' }, rates).fee).toBe(0.33)
  })
})

describe('summarizeFees', () => {
  it('soma bruto, taxa e líquido', () => {
    const s = summarizeFees(
      [
        { amount: 100, method: 'PIX' },
        { amount: 200, method: 'CREDIT_CARD' },
      ],
      rates,
    )
    expect(s.gross).toBe(300)
    expect(s.fee).toBe(11) // 1 + 10
    expect(s.net).toBe(289)
    expect(s.count).toBe(2)
  })

  it('conta separadamente o que é real e o que é estimado', () => {
    // Enquanto `estimatedCount > 0`, a linha é parcialmente estimativa — e a tela precisa dizer.
    const s = summarizeFees(
      [
        { amount: 100, method: 'PIX', gatewayFee: 0.8, feeBasis: 'GATEWAY' },
        { amount: 100, method: 'PIX' },
      ],
      rates,
    )
    expect(s.realCount).toBe(1)
    expect(s.estimatedCount).toBe(1)
    expect(s.fee).toBe(1.8) // 0.80 real + 1.00 estimada
  })

  it('taxa efetiva em % do bruto', () => {
    const s = summarizeFees([{ amount: 100, method: 'CREDIT_CARD' }], rates)
    expect(s.effectivePct).toBe(5)
  })

  it('lista vazia não divide por zero', () => {
    const s = summarizeFees([], rates)
    expect(s).toMatchObject({ gross: 0, fee: 0, net: 0, count: 0, effectivePct: 0 })
  })
})

describe('extractMercadoPagoFee', () => {
  it('soma as taxas pagas pelo vendedor', () => {
    expect(
      extractMercadoPagoFee({
        fee_details: [
          { type: 'mercadopago_fee', amount: 0.99, fee_payer: 'collector' },
          { type: 'application_fee', amount: 0.5, fee_payer: 'collector' },
        ],
      }),
    ).toBe(1.49)
  })

  it('ignora taxa paga pelo COMPRADOR — ela não reduz o recebido', () => {
    expect(
      extractMercadoPagoFee({
        fee_details: [
          { type: 'mercadopago_fee', amount: 0.99, fee_payer: 'collector' },
          { type: 'financing_fee', amount: 5, fee_payer: 'payer' },
        ],
      }),
    ).toBe(0.99)
  })

  it('`fee_payer` ausente é tratado como do vendedor', () => {
    // Ignorá-lo subestimaria a taxa — erro que INFLA o lucro, o pior dos dois lados.
    expect(extractMercadoPagoFee({ fee_details: [{ amount: 0.99 }] })).toBe(0.99)
  })

  it('payload sem fee_details ou malformado devolve null', () => {
    expect(extractMercadoPagoFee({})).toBeNull()
    expect(extractMercadoPagoFee({ fee_details: 'nope' })).toBeNull()
    expect(extractMercadoPagoFee(null)).toBeNull()
  })

  it('lista só com valores inválidos devolve null, não zero', () => {
    // Zero seria lido como "não teve taxa"; null é "não sei", e a estimativa assume.
    expect(extractMercadoPagoFee({ fee_details: [{ amount: 'x' }] })).toBeNull()
  })

  it('lista vazia devolve null', () => {
    expect(extractMercadoPagoFee({ fee_details: [] })).toBeNull()
  })
})

describe('recordGatewayFee', () => {
  it('grava taxa, líquido e a base', async () => {
    const { prisma, updates } = makePrisma()
    await recordGatewayFee(prisma, 'pay-1', 0.99, 100)

    expect(updates[0].data).toEqual({ gatewayFee: 0.99, netAmount: 99.01, feeBasis: 'GATEWAY' })
  })

  it('não grava quando a taxa é nula ou não numérica', async () => {
    const { prisma, updates } = makePrisma()
    await recordGatewayFee(prisma, 'pay-1', null, 100)
    await recordGatewayFee(prisma, 'pay-1', undefined, 100)
    await recordGatewayFee(prisma, 'pay-1', Number.NaN, 100)

    expect(updates).toHaveLength(0)
  })

  it('rejeita taxa negativa ou maior que o pagamento (dado corrompido)', async () => {
    // Gravar produziria um líquido negativo que contaminaria o DRE.
    const { prisma, updates } = makePrisma()
    await recordGatewayFee(prisma, 'pay-1', -1, 100)
    await recordGatewayFee(prisma, 'pay-1', 101, 100)

    expect(updates).toHaveLength(0)
  })

  it('aceita taxa igual ao valor (caso limite legítimo)', async () => {
    const { prisma, updates } = makePrisma()
    await recordGatewayFee(prisma, 'pay-1', 100, 100)
    expect(updates[0].data).toMatchObject({ gatewayFee: 100, netAmount: 0 })
  })
})
