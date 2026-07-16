// Credits service unit tests -- Wave 1 implementation (GREEN state)
// Requirements: CRED-03, CRED-04
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

import { CreditsService } from '../credits.service.js'

function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      combo: { findMany: vi.fn() },
      promotion: { findMany: vi.fn().mockResolvedValue([]) },
      setting: { findMany: vi.fn(), findUnique: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      creditTransaction: { create: vi.fn(), findMany: vi.fn() },
      ...overrides,
    },
  } as unknown as FastifyInstance
}

describe('CreditsService [CRED-03, CRED-04]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUnitPrice [CRED-04]', () => {
    it('preco unitario avulso e maior que o melhor preco por pao dos combos disponiveis', async () => {
      const mockFastify = createMockFastify()
      // Combo com melhor preco por pao = R$10 / 10 poes = R$1.00/pao
      ;(mockFastify.prisma.combo.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'combo-1', name: 'Combo Básico', quantity: 10, price: 10.0, isActive: true },
        { id: 'combo-2', name: 'Combo Família', quantity: 30, price: 24.9, isActive: true },
      ])
      // avulsoUnit = R$1.50/pao (maior que R$1.00/pao do melhor combo)
      ;(mockFastify.prisma.setting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        key: 'avulsoUnit',
        value: '1.50',
      })

      const service = new CreditsService(mockFastify)
      const result = await service.getUnitPrice()

      expect(result.avulsoUnit).toBeGreaterThan(result.bestComboUnitPrice)
    })

    it('getUnitPrice retorna preco correto baseado na configuracao de avulsoLimite', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.combo.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'combo-1', name: 'Combo Básico', quantity: 10, price: 10.0, isActive: true },
      ])
      ;(mockFastify.prisma.setting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        key: 'avulsoUnit',
        value: '1.75',
      })

      const service = new CreditsService(mockFastify)
      const result = await service.getUnitPrice()

      expect(result.avulsoUnit).toBe(1.75)
    })
  })

  describe('listCombos (promoção)', () => {
    it('aplica desconto: price = preço com desconto e antes = preço original', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.combo.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'combo-1', name: 'Combo Novo', quantity: 100, price: 99.9, tag: null, isActive: true },
        { id: 'combo-2', name: 'Combo Básico', quantity: 20, price: 29.9, tag: 'Mais popular', isActive: true },
      ])
      ;(mockFastify.prisma.promotion.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { comboId: 'combo-1', discountType: 'PERCENT', discountValue: 15, isActive: true },
      ])

      const service = new CreditsService(mockFastify)
      const result = await service.listCombos()

      const promo = result.find((c) => c.id === 'combo-1')!
      expect(promo.price).toBe(84.92)
      expect(promo.antes).toBe(99.9)
      expect(promo.isOnPromotion).toBe(true)

      const semPromo = result.find((c) => c.id === 'combo-2')!
      expect(semPromo.price).toBe(29.9)
      expect(semPromo.isOnPromotion).toBe(false)
      expect(semPromo).not.toHaveProperty('antes')
    })
  })

  describe('listCombos (economia calculada e subtítulo)', () => {
    it('calcula economyPercent/economySavings vs. avulso quando showEconomy=true', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.combo.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: 'combo-1',
          name: 'Família',
          quantity: 30,
          price: 24.9,
          tag: 'Mais popular',
          description: 'O equilíbrio da casa',
          showEconomy: true,
          isActive: true,
        },
      ])
      // avulsoUnit = R$1,20 → cheio = 36,00 → economia = 11,10 (≈31%)
      ;(mockFastify.prisma.setting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        key: 'avulsoUnit',
        value: '1.20',
      })

      const service = new CreditsService(mockFastify)
      const result = await service.listCombos()

      const combo = result.find((c) => c.id === 'combo-1')!
      expect(combo.description).toBe('O equilíbrio da casa')
      expect(combo.economySavings).toBeCloseTo(11.1, 2)
      expect(combo.economyPercent).toBe(31)
    })

    it('não expõe economia quando showEconomy=false', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.combo.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'combo-1', name: 'Família', quantity: 30, price: 24.9, showEconomy: false, isActive: true },
      ])
      ;(mockFastify.prisma.setting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        key: 'avulsoUnit',
        value: '1.20',
      })

      const service = new CreditsService(mockFastify)
      const result = await service.listCombos()

      const combo = result.find((c) => c.id === 'combo-1')!
      expect(combo.economyPercent).toBeNull()
      expect(combo.economySavings).toBeNull()
    })
  })

  describe('validateQuantity [CRED-03]', () => {
    it('rejeita quantity >= avulsoLimite (deve usar combo, nao avulso)', async () => {
      const mockFastify = createMockFastify()
      const service = new CreditsService(mockFastify)

      await expect(service.validateCustomPurchase(10, 10)).rejects.toMatchObject({
        error: expect.stringContaining('limite'),
        status: 400,
      })

      await expect(service.validateCustomPurchase(15, 10)).rejects.toMatchObject({
        error: expect.stringContaining('limite'),
        status: 400,
      })
    })

    it('aceita quantity < avulsoLimite para compra avulsa', async () => {
      const mockFastify = createMockFastify()
      const service = new CreditsService(mockFastify)

      // Deve resolver sem erro
      await expect(service.validateCustomPurchase(5, 10)).resolves.toBeUndefined()
      await expect(service.validateCustomPurchase(1, 10)).resolves.toBeUndefined()
    })

    it('rejeita quantity <= 0', async () => {
      const mockFastify = createMockFastify()
      const service = new CreditsService(mockFastify)

      await expect(service.validateCustomPurchase(0, 10)).rejects.toMatchObject({
        error: expect.stringContaining('positiva'),
        status: 400,
      })

      await expect(service.validateCustomPurchase(-1, 10)).rejects.toMatchObject({
        error: expect.stringContaining('positiva'),
        status: 400,
      })
    })
  })

  describe('getPricing [CRED-04]', () => {
    it('retorna avulsoLimite e avulsoUnit a partir das configuracoes do banco', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.setting.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { key: 'avulsoLimite', value: '10' },
        { key: 'avulsoUnit', value: '1.50' },
      ])

      const service = new CreditsService(mockFastify)
      const result = await service.getPricing()

      expect(result.avulsoLimite).toBe(10)
      expect(result.avulsoUnit).toBe(1.5)
    })

    it('retorna zeros quando as configuracoes nao existem no banco', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.setting.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      const service = new CreditsService(mockFastify)
      const result = await service.getPricing()

      expect(result.avulsoLimite).toBe(0)
      expect(result.avulsoUnit).toBe(0)
    })
  })
})
