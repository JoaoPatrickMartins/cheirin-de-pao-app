// Disponibilidade dos produtos na leitura do cliente (catálogo + Cestinha).
//
// O que está sob teste é a promessa central da feature: as três causas de indisponibilidade
// (sem estoque, pausado pelo admin, fora do prazo do ciclo de entrega) colapsam num único
// `soldOut`, o card NÃO some do catálogo, e a quantidade já no carrinho não é zerada em silêncio.
//
// A regra em si tem teste próprio e exaustivo em lib/__tests__/product-availability.test.ts —
// aqui o foco é a fiação: o serviço resolve o ciclo de referência e aplica a regra em cada linha.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    constructor(_f: unknown) {}
    notifyUser = vi.fn().mockResolvedValue(undefined)
    notifyAdmins = vi.fn().mockResolvedValue(undefined)
  },
}))

/**
 * O GATEWAY NÃO ENTRA NO TESTE.
 *
 * Um checkout que chega ao fim com `moneyAmount > 0` cai no passo 13 e chama o Mercado Pago de
 * verdade — e `@prisma/client`, ao ser importado, carrega o `.env` do projeto, então o
 * `MP_ACCESS_TOKEN` de PRODUÇÃO fica visível dentro do teste. Sem este mock, `npm test` bate na
 * API de pagamento com a credencial real; hoje só não cria cobrança porque o usuário do mock não
 * tem e-mail nem CPF e o MP recusa por `payer_cannot_be_nil`.
 *
 * Era isso também que pendurava os dois testes de promoção: com os timers falsos do
 * `beforeEach`, o cliente HTTP do SDK esperava por um timer que nunca avançava, e o teste
 * estourava em 5s em vez de falhar.
 */
vi.mock('../../payments/payments.service.js', () => ({
  PaymentsService: class {
    constructor(_f: unknown) {}
    createMarketPix = vi.fn().mockResolvedValue({
      paymentId: 'pay-fake',
      status: 'pending' as const,
      pixCopyPaste: '00020126',
      pixQrCodeUrl: '',
      expiresAt: null,
    })
    createMarketCard = vi.fn().mockResolvedValue({ paymentId: 'pay-fake', status: 'pending' as const })
  },
}))

import { MarketService } from '../market.service.js'
import { MarketCheckoutService } from '../market-checkout.service.js'

const CONDO_ID = 'condo-01'
const USER_ID = 'user-01'

/** Turno da manhã: entrega 06:30, corte 22:00 da véspera. */
const SLOT_MANHA = { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }

/** "2026-09-20 09:00" BRT = 12:00 UTC. */
const brt = (dateStr: string, hhmm: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, m, 0, 0))
}

type ProductSeed = {
  id: string
  name: string
  sortOrder?: number
  stock?: number
  availableFrom?: string | null
  availableUntil?: string | null
  isPaused?: boolean | null
  pausedUntil?: Date | null
  isNew?: boolean | null
  newUntil?: Date | null
  isPromo?: boolean | null
  promoType?: 'PERCENT' | 'FIXED' | null
  promoValue?: number | null
  promoUntil?: Date | null
  promoPriority?: boolean | null
}

const seed = (p: ProductSeed) => ({
  description: null,
  categoryId: 'cat-1',
  price: 10,
  photoUrl: null,
  stockType: 'FIXED' as const,
  stock: 99,
  dailyCapacity: null,
  availableDays: [],
  isActive: true,
  sortOrder: 0,
  availableFrom: null,
  availableUntil: null,
  isPaused: null,
  pausedUntil: null,
  isNew: null,
  newUntil: null,
  isPromo: null,
  promoType: null,
  promoValue: null,
  promoUntil: null,
  promoPriority: null,
  ...p,
})

function mockFastify(products: ProductSeed[], cartItems: { productId: string; qty: number }[] = []) {
  const rows = products.map(seed)
  const settings: Record<string, string> = {
    avulsoUnit: '1.00',
    marketMinimoCestinha: '0',
    pedidoMinimoUnico: '1',
    marketCartaoMinimo: '0',
  }

  const prisma = {
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(settings[where.key] != null ? { key: where.key, value: settings[where.key] } : null),
      ),
    },
    product: {
      // Serve às duas leituras: a lista do catálogo (`where.isActive`) e a junção do
      // carrinho (`where.id.in`). O `orderBy` do banco é simulado por sortOrder + nome.
      findMany: vi.fn().mockImplementation((args: { where?: { id?: { in: string[] } } }) => {
        const ids = args?.where?.id?.in
        const out = ids ? rows.filter((r) => ids.includes(r.id)) : [...rows]
        out.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        return Promise.resolve(out)
      }),
    },
    productCategory: {
      findMany: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Geleias', emoji: '🫙', sortOrder: 0 }]),
    },
    cart: {
      findUnique: vi.fn().mockResolvedValue({ userId: USER_ID, items: cartItems, breadQty: 0 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: USER_ID, condominiumId: CONDO_ID, creditMilli: 0 }),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue({ deliverySlots: [SLOT_MANHA] }),
    },
    // Só o checkout usa daqui para baixo. A maioria dos casos é barrada no passo 7.1, antes de
    // tocar em estoque ou transação — mas os testes de promoção vão até o fim (criam o pedido e
    // chegam ao gateway, que está mockado acima), então estes mocks precisam cobrir o caminho
    // completo, não só o começo.
    marketOrder: { findUnique: vi.fn().mockResolvedValue(null) },
    productDailyStock: { findUnique: vi.fn().mockResolvedValue(null) },
    deliveryBlock: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]) },
    schedule: { findMany: vi.fn().mockResolvedValue([]) },
    creditTransaction: { create: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    // A transação roda de verdade contra o mock, para dar para inspecionar o que foi GRAVADO —
    // é o único jeito de provar que o snapshot guardou o preço cobrado, e não o de tabela.
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
  }

  Object.assign(prisma.product, {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({}),
    // Releitura do estoque após a reserva (alertStockAfterReserve). É best-effort no serviço,
    // então sem isto o teste passava mascarando um TypeError engolido pelo try/catch.
    findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    ),
  })
  Object.assign(prisma.productDailyStock, {
    upsert: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  })
  Object.assign(prisma.user, { update: vi.fn().mockResolvedValue({}) })
  Object.assign(prisma.marketOrder, {
    create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'mo-1', ...data, items: (data.items as { set: unknown }).set }),
    ),
    findMany: vi.fn().mockResolvedValue([]),
  })

  return { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance
}

/** Congela o relógio num horário BRT do dia 20/09/2026. */
const at = (hhmm: string) => vi.setSystemTime(brt('2026-09-20', hhmm))

describe('disponibilidade do catálogo e da Cestinha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Só o RELÓGIO é falso. Falsificar `setTimeout` junto pendura qualquer cliente HTTP que
    // entre no caminho (foi o que travou os testes de promoção por 5s), e este arquivo nunca
    // precisou avançar timer — só congelar a hora para testar horário de venda e promoção.
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => vi.useRealTimers())

  // REGRESSÃO (UAT 19/09/2026): com o horário como corte por ciclo de entrega, um produto com
  // "fecha 20:00" reabria às 22:00 — ou às 10:00, conforme os turnos do condomínio — em vez de
  // ficar fechado. O catálogo mostrava "Adicionar" num item que o admin tinha fechado.
  describe('horário de venda', () => {
    const geleia: ProductSeed = { id: 'p1', name: 'Geleia', availableUntil: '20:00', availableFrom: '22:00' }

    it('disponível antes de fechar', async () => {
      at('19:59')
      const { products } = await new MarketService(mockFastify([geleia])).getCatalog()
      expect(products[0]).toMatchObject({ id: 'p1', soldOut: false })
    })

    it('fecha na hora configurada — e CONTINUA no catálogo', async () => {
      at('20:00')
      const { products } = await new MarketService(mockFastify([geleia])).getCatalog()
      expect(products).toHaveLength(1) // não some da vitrine
      expect(products[0]).toMatchObject({ id: 'p1', soldOut: true })
    })

    it('segue fechado até a hora de reabrir', async () => {
      at('21:59')
      const { products } = await new MarketService(mockFastify([geleia])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: true })
    })

    it('reabre na hora configurada, e em nenhuma outra', async () => {
      at('22:00')
      const { products } = await new MarketService(mockFastify([geleia])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: false })
    })

    it('só "fecha 20:00": segue fechado a madrugada toda', async () => {
      const soFecha: ProductSeed = { id: 'p1', name: 'Geleia', availableUntil: '20:00' }
      for (const h of ['20:00', '22:00', '23:00']) {
        at(h)
        const { products } = await new MarketService(mockFastify([soFecha])).getCatalog()
        expect(products[0], `às ${h}`).toMatchObject({ soldOut: true })
      }
      at('00:30')
      const { products } = await new MarketService(mockFastify([soFecha])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: false })
    })

    it('produto sem horário nenhum nunca fecha', async () => {
      at('03:00')
      const livre: ProductSeed = { id: 'p2', name: 'Café' }
      const { products } = await new MarketService(mockFastify([livre])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: false })
    })

    it('funciona SEM turno ativo no condomínio — era o buraco silencioso', async () => {
      at('21:00')
      const fastify = mockFastify([{ id: 'p1', name: 'Geleia', availableUntil: '20:00' }])
      ;(fastify.prisma.condominium.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        deliverySlots: [],
      })
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: true })
    })
  })

  describe('pausa de vitrine', () => {
    it('pausa sem prazo aparece como esgotado', async () => {
      at('09:00')
      const p: ProductSeed = { id: 'p1', name: 'Geleia', isPaused: true }
      const { products } = await new MarketService(mockFastify([p])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: true })
    })

    it('pausa com prazo vigente aparece como esgotado', async () => {
      at('09:00')
      const p: ProductSeed = { id: 'p1', name: 'Geleia', pausedUntil: brt('2026-09-20', '09:30') }
      const { products } = await new MarketService(mockFastify([p])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: true })
    })

    it('pausa com prazo expirada volta sozinha — sem ninguém tocar em nada', async () => {
      at('09:31')
      const p: ProductSeed = { id: 'p1', name: 'Geleia', pausedUntil: brt('2026-09-20', '09:30') }
      const { products } = await new MarketService(mockFastify([p])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: false })
    })

    it('expirada a pausa, o horário de venda ainda barra', async () => {
      at('10:31')
      const p: ProductSeed = {
        id: 'p1',
        name: 'Geleia',
        availableUntil: '10:00',
        pausedUntil: brt('2026-09-20', '10:30'),
      }
      const { products } = await new MarketService(mockFastify([p])).getCatalog()
      expect(products[0]).toMatchObject({ soldOut: true })
    })
  })

  describe('novidade', () => {
    it('sobe para a frente da grade e marca isNew', async () => {
      at('09:00')
      const fastify = mockFastify([
        { id: 'p1', name: 'Amanteigado', sortOrder: 0 },
        { id: 'p2', name: 'Zimbro', sortOrder: 5, isNew: true },
      ])
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products.map((p) => p.id)).toEqual(['p2', 'p1'])
      expect(products[0].isNew).toBe(true)
      expect(products[1].isNew).toBe(false)
    })

    it('novidade expirada não sobe nem recebe o selo', async () => {
      at('09:00')
      const fastify = mockFastify([
        { id: 'p1', name: 'Amanteigado', sortOrder: 0 },
        { id: 'p2', name: 'Zimbro', sortOrder: 5, isNew: true, newUntil: brt('2026-09-19', '00:00') },
      ])
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products.map((p) => p.id)).toEqual(['p1', 'p2'])
      expect(products.every((p) => p.isNew === false)).toBe(true)
    })

    it('várias novidades convivem, na ordem definida pelo admin', async () => {
      at('09:00')
      const fastify = mockFastify([
        { id: 'p1', name: 'Comum', sortOrder: 9 },
        { id: 'p2', name: 'Nova B', sortOrder: 1, isNew: true },
        { id: 'p3', name: 'Nova A', sortOrder: 0, isNew: true },
      ])
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products.map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])
    })

    it('o selo continua valendo num produto esgotado', async () => {
      at('09:00')
      const fastify = mockFastify([{ id: 'p1', name: 'Geleia', isNew: true, isPaused: true }])
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products[0]).toMatchObject({ isNew: true, soldOut: true })
    })
  })

  describe('Cestinha (carrinho)', () => {
    it('marca a linha como esgotada SEM zerar a quantidade', async () => {
      at('09:00')
      const fastify = mockFastify([{ id: 'p1', name: 'Geleia', isPaused: true }], [{ productId: 'p1', qty: 3 }])
      const cart = await new MarketService(fastify).getCart(USER_ID)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0]).toMatchObject({ productId: 'p1', qty: 3, soldOut: true })
      // O valor segue contando: quem decide remover é o cliente, não a pausa.
      expect(cart.subtotal).toBe(30)
    })

    it('linha fora do horário de venda também vem marcada', async () => {
      at('11:00')
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', availableUntil: '10:00' }],
        [{ productId: 'p1', qty: 1 }],
      )
      const cart = await new MarketService(fastify).getCart(USER_ID)
      expect(cart.items[0].soldOut).toBe(true)
    })

    it('linha disponível não é marcada', async () => {
      at('09:00')
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', availableUntil: '10:00' }],
        [{ productId: 'p1', qty: 1 }],
      )
      const cart = await new MarketService(fastify).getCart(USER_ID)
      expect(cart.items[0].soldOut).toBe(false)
    })
  })

  describe('promoção', () => {
    const PROMO = { isPromo: true, promoType: 'PERCENT' as const, promoValue: 18 }

    it('o catálogo serve o preço JÁ com desconto e o cheio para o riscado', async () => {
      at('09:00')
      const { products } = await new MarketService(
        mockFastify([{ id: 'p1', name: 'Geleia', ...PROMO }]),
      ).getCatalog()

      // Seed de R$ 10 − 18% = R$ 8,20
      expect(products[0]).toMatchObject({ price: 8.2, priceBefore: 10, isPromo: true })
    })

    it('promoção vencida volta ao preço cheio sozinha, sem riscado', async () => {
      at('09:00')
      const { products } = await new MarketService(
        mockFastify([{ id: 'p1', name: 'Geleia', ...PROMO, promoUntil: brt('2026-09-19', '00:00') }]),
      ).getCatalog()

      expect(products[0]).toMatchObject({ price: 10, priceBefore: null, isPromo: false })
    })

    it('promoção destacada sobe, mas fica ATRÁS da novidade', async () => {
      at('09:00')
      const fastify = mockFastify([
        { id: 'comum', name: 'A comum', sortOrder: 0 },
        { id: 'promo', name: 'B promo', sortOrder: 1, ...PROMO, promoPriority: true },
        { id: 'nova', name: 'C nova', sortOrder: 2, isNew: true },
      ])
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products.map((p) => p.id)).toEqual(['nova', 'promo', 'comum'])
    })

    it('promoção SEM destaque não fura fila, mas mantém o selo', async () => {
      at('09:00')
      const fastify = mockFastify([
        { id: 'comum', name: 'A comum', sortOrder: 0 },
        { id: 'promo', name: 'B promo', sortOrder: 1, ...PROMO },
      ])
      const { products } = await new MarketService(fastify).getCatalog()
      expect(products.map((p) => p.id)).toEqual(['comum', 'promo'])
      expect(products.find((p) => p.id === 'promo')!.isPromo).toBe(true)
    })

    it('a Cestinha cobra o preço promocional na linha e no subtotal', async () => {
      at('09:00')
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', ...PROMO }],
        [{ productId: 'p1', qty: 2 }],
      )
      const cart = await new MarketService(fastify).getCart(USER_ID)

      expect(cart.items[0]).toMatchObject({ price: 8.2, priceBefore: 10, lineTotal: 16.4 })
      expect(cart.subtotal).toBe(16.4)
    })
  })

  // O catálogo e a Cestinha usam o ciclo de REFERÊNCIA (aproximação); o checkout é o único que
  // avalia contra a data REALMENTE escolhida — e é ele a autoridade. Antes desta onda ele só
  // olhava `isActive`, então quem já tivesse o item no carrinho passava por cima da pausa.
  describe('checkout (autoridade)', () => {
    const input = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      scheduledDate: '2026-09-21',
      slotId: 'manha',
      creditsApplied: 0,
      paymentMethod: 'pix' as const,
    }

    it('bloqueia produto pausado com a MESMA mensagem de esgotado', async () => {
      at('09:00')
      const fastify = mockFastify([{ id: 'p1', name: 'Geleia', isPaused: true }], [{ productId: 'p1', qty: 1 }])
      await expect(new MarketCheckoutService(fastify).checkout(USER_ID, input)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Geleia está esgotado.',
      })
    })

    it('a mensagem NUNCA revela que o produto foi pausado', async () => {
      at('09:00')
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', pausedUntil: brt('2026-09-20', '09:30') }],
        [{ productId: 'p1', qty: 1 }],
      )
      const err = await new MarketCheckoutService(fastify)
        .checkout(USER_ID, input)
        .catch((e: { message: string }) => e)
      expect((err as { message: string }).message).not.toMatch(/paus/i)
    })

    it('bloqueia produto fora do horário de venda', async () => {
      at('11:00') // a loja deste produto fecha às 10:00
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', availableUntil: '10:00' }],
        [{ productId: 'p1', qty: 1 }],
      )
      await expect(new MarketCheckoutService(fastify).checkout(USER_ID, input)).rejects.toMatchObject({
        statusCode: 409,
      })
    })

    it('grava no SNAPSHOT o preço promocional, não o de tabela', async () => {
      at('09:00')
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', isPromo: true, promoType: 'PERCENT', promoValue: 18 }],
        [{ productId: 'p1', qty: 2 }],
      )
      // 100% em dinheiro (saldo 0) para o pedido nascer sem passar pelo gateway de crédito.
      await new MarketCheckoutService(fastify).checkout(USER_ID, input).catch(() => null)

      const create = fastify.prisma.marketOrder.create as ReturnType<typeof vi.fn>
      expect(create).toHaveBeenCalled()
      const data = create.mock.calls[0][0].data
      // R$ 10 − 18% = R$ 8,20 × 2 = R$ 16,40. Gravar R$ 10 aqui inflaria a receita para sempre.
      expect(data.items.set[0].unitPrice).toBe(8.2)
      expect(data.totalValue).toBe(16.4)
    })

    it('promoção vencida cobra o preço cheio — o checkout é a autoridade', async () => {
      at('09:00')
      const fastify = mockFastify(
        [{
          id: 'p1',
          name: 'Geleia',
          isPromo: true,
          promoType: 'PERCENT',
          promoValue: 18,
          promoUntil: brt('2026-09-19', '00:00'),
        }],
        [{ productId: 'p1', qty: 1 }],
      )
      await new MarketCheckoutService(fastify).checkout(USER_ID, input).catch(() => null)

      const create = fastify.prisma.marketOrder.create as ReturnType<typeof vi.fn>
      expect(create.mock.calls[0][0].data.items.set[0].unitPrice).toBe(10)
    })

    it('deixa passar do passo 7.1 quando o produto está dentro do prazo', async () => {
      at('09:00')
      const fastify = mockFastify(
        [{ id: 'p1', name: 'Geleia', availableUntil: '10:00' }],
        [{ productId: 'p1', qty: 1 }],
      )
      // Controle positivo: uma data bloqueada é checada DEPOIS do 7.1, então receber o erro de
      // data bloqueada prova que a disponibilidade deixou o pedido seguir.
      ;(fastify.prisma.deliveryBlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { startDate: '2026-09-21', endDate: '2026-09-21', reason: 'Feriado' },
      ])
      const err = await new MarketCheckoutService(fastify)
        .checkout(USER_ID, input)
        .catch((e: { statusCode: number; message: string }) => e)

      expect(err).toMatchObject({ statusCode: 422 })
      expect((err as { message: string }).message).not.toMatch(/esgotad/i)
    })
  })
})
