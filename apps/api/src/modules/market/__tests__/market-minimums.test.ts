// Pedido mínimo da Cestinha resolvido POR CONDOMÍNIO (override ?? padrão global).
//
// Dois lados da mesma regra:
//  - `MarketService.getCart` monta o `CartView` que a UI usa para liberar/travar o CTA
//    (`minimo`, `breadMin`, `meetsMinimum`);
//  - `MarketCheckoutService.checkout` é a AUTORIDADE — bloqueia mesmo que o front deixe passar.
//
// Antes desta onda não havia nenhum teste do mínimo da Cestinha nem do `breadMin`.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    constructor(_fastify: unknown) {}
    notifyUser = vi.fn().mockResolvedValue(undefined)
    notifyAdmins = vi.fn().mockResolvedValue(undefined)
  },
}))

import { MarketService } from '../market.service.js'
import { MarketCheckoutService } from '../market-checkout.service.js'

const CONDO_ID = 'condo-01'
const USER_ID = 'user-01'

/** Produto de teste — sempre disponível, estoque folgado (o foco é o mínimo, não o estoque). */
const PRODUTO = {
  id: 'prod-1',
  name: 'Geleia',
  price: 10,
  photoUrl: null,
  categoryId: 'cat-1',
  stockType: 'FIXED' as const,
  stock: 99,
  dailyCapacity: null,
  isActive: true,
  availableDays: [],
}

/** Data futura (YYYY-MM-DD) — evita o corte e a validação de passado. */
function futureDateStr(days = 3): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

interface MockOpts {
  /** Padrão global (Setting). */
  globalCestinha?: string
  globalUnico?: string
  /** Overrides no documento do condomínio. Ausentes = herda. */
  condoOverrides?: Record<string, unknown>
  /** Conteúdo da Cestinha. */
  items?: { productId: string; qty: number }[]
  breadQty?: number
}

function mockFastify(opts: MockOpts = {}) {
  const {
    globalCestinha = '15.00',
    globalUnico = '1',
    condoOverrides = {},
    items = [],
    breadQty = 0,
  } = opts

  const settings: Record<string, string> = {
    avulsoUnit: '1.00',
    marketMinimoCestinha: globalCestinha,
    pedidoMinimoUnico: globalUnico,
    marketCartaoMinimo: '0',
  }

  const prisma = {
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(settings[where.key] != null ? { key: where.key, value: settings[where.key] } : null),
      ),
    },
    cart: {
      findUnique: vi.fn().mockResolvedValue({ userId: USER_ID, items, breadQty }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    product: {
      findMany: vi.fn().mockResolvedValue(items.length > 0 ? [PRODUTO] : []),
      findUnique: vi.fn().mockResolvedValue(PRODUTO),
    },
    productDailyStock: { findUnique: vi.fn().mockResolvedValue(null) },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: USER_ID,
        condominiumId: CONDO_ID,
        creditMilli: 0,
      }),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue({
        // O mesmo documento serve às três leituras do checkout (mínimos, slots e restrições).
        deliverySlots: [
          { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
        ],
        ...condoOverrides,
      }),
    },
    marketOrder: { findUnique: vi.fn().mockResolvedValue(null) },
    deliveryBlock: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]) },
    schedule: { findMany: vi.fn().mockResolvedValue([]) },
  }

  return { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance
}

describe('mínimo da Cestinha por condomínio', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('MarketService.getCart (régua da UI)', () => {
    it('herda o mínimo global quando o condomínio não personalizou', async () => {
      const fastify = mockFastify({ items: [{ productId: 'prod-1', qty: 1 }] })
      const cart = await new MarketService(fastify).getCart(USER_ID)

      expect(cart.minimo).toBe(15)
      expect(cart.subtotal).toBe(10)
      expect(cart.meetsMinimum).toBe(false) // R$ 10 < R$ 15
    })

    it('usa o mínimo do condomínio quando ele personalizou', async () => {
      const fastify = mockFastify({
        items: [{ productId: 'prod-1', qty: 1 }],
        condoOverrides: { marketMinimoCestinhaOverride: 5 },
      })
      const cart = await new MarketService(fastify).getCart(USER_ID)

      expect(cart.minimo).toBe(5)
      expect(cart.meetsMinimum).toBe(true) // R$ 10 >= R$ 5
    })

    it('breadMin acompanha o mínimo do pedido único do condomínio', async () => {
      const fastify = mockFastify({
        breadQty: 3,
        globalUnico: '1',
        condoOverrides: { pedidoMinimoUnicoOverride: 6 },
      })
      const cart = await new MarketService(fastify).getCart(USER_ID)

      expect(cart.breadMin).toBe(6)
      // Carrinho só de pão é isento do mínimo em R$, mas não do mínimo de pães.
      expect(cart.meetsMinimum).toBe(false)
    })

    it('carrinho só de pão no mínimo do condomínio passa (isento do mínimo em R$)', async () => {
      const fastify = mockFastify({
        breadQty: 6,
        condoOverrides: { pedidoMinimoUnicoOverride: 6, marketMinimoCestinhaOverride: 50 },
      })
      const cart = await new MarketService(fastify).getCart(USER_ID)

      expect(cart.meetsMinimum).toBe(true)
    })
  })

  describe('MarketCheckoutService.checkout (autoridade)', () => {
    const input = (extra: Record<string, unknown> = {}) => ({
      idempotencyKey: 'idem-1',
      scheduledDate: `${futureDateStr()}T12:00:00.000Z`,
      slotId: 'tarde',
      creditsApplied: 0,
      paymentMethod: 'pix' as const,
      ...extra,
    })

    it('bloqueia (422) abaixo do mínimo EM R$ do condomínio', async () => {
      const fastify = mockFastify({
        items: [{ productId: 'prod-1', qty: 1 }], // R$ 10
        globalCestinha: '5.00', // padrão global deixaria passar
        condoOverrides: { marketMinimoCestinhaOverride: 30 },
      })

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new MarketCheckoutService(fastify).checkout(USER_ID, input() as any),
      ).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining('pedido mínimo da Cestinha'),
      })
    })

    it('bloqueia (422) abaixo do mínimo de PÃES do condomínio', async () => {
      const fastify = mockFastify({
        breadQty: 2,
        globalUnico: '1',
        condoOverrides: { pedidoMinimoUnicoOverride: 6 },
      })

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new MarketCheckoutService(fastify).checkout(USER_ID, input() as any),
      ).rejects.toMatchObject({ statusCode: 422, message: 'O pedido mínimo de pães é 6 pães.' })
    })

    it('não bloqueia quando o condomínio afrouxa o mínimo global', async () => {
      const fastify = mockFastify({
        items: [{ productId: 'prod-1', qty: 1 }], // R$ 10
        globalCestinha: '30.00', // o padrão global bloquearia
        condoOverrides: { marketMinimoCestinhaOverride: 5 },
      })

      // Passa do mínimo e segue o fluxo. O checkout pode falhar adiante (a transação não é
      // mockada aqui), mas o que importa é que o motivo NÃO seja o pedido mínimo.
      let erro: unknown = null
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new MarketCheckoutService(fastify).checkout(USER_ID, input() as any)
      } catch (e) {
        erro = e
      }
      const msg = (erro as { message?: string } | null)?.message ?? ''
      expect(msg).not.toContain('pedido mínimo')
    })
  })
})
