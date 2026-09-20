// Pausa de vitrine, ordem da vitrine e selo de novidade (lado admin).
//
// A regra de quando um produto aceita pedido tem teste próprio em
// lib/__tests__/product-availability.test.ts. Aqui o foco é o que só o serviço decide:
// o que é gravado ao pausar, o que o admin enxerga de volta, e a atomicidade do reorder —
// que é o que impede a vitrine de ficar com ordem nova e selo velho.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    constructor(_f: unknown) {}
    notifyUser = vi.fn()
    notifyAdmins = vi.fn()
  },
}))

import { AdminMarketService } from '../admin-market.service.js'
import { DEFAULT_NOVIDADE_DAYS } from '../../../lib/product-availability.js'
import { DEFAULT_PROMO_DAYS } from '../../../lib/product-pricing.js'

const ADMIN_ID = 'admin-1'
const BREAD_ID = 'pao-frances'

const SLOT_MANHA = { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00', isActive: true }

const brt = (dateStr: string, hhmm: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, m, 0, 0))
}

type Row = {
  id: string
  name: string
  sortOrder?: number
  isActive?: boolean
  stock?: number | null
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

const row = (r: Row) => ({
  description: null,
  categoryId: 'cat-1',
  price: 10,
  photoUrl: null,
  stockType: 'FIXED' as const,
  stock: 99,
  dailyCapacity: null,
  availableDays: [],
  availableFrom: null,
  availableUntil: null,
  isActive: true,
  sortOrder: 0,
  isPaused: null,
  pausedUntil: null,
  pauseReason: null,
  pausedBy: null,
  pausedAt: null,
  isNew: null,
  newUntil: null,
  isPromo: null,
  promoType: null,
  promoValue: null,
  promoUntil: null,
  promoPriority: null,
  ...r,
})

function makeService(rows: Row[]) {
  const store = new Map(rows.map((r) => [r.id, row(r) as Record<string, unknown>]))

  const update = vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const cur = store.get(where.id)
    if (!cur) return Promise.reject(new Error('not found'))
    const next = { ...cur, ...data }
    store.set(where.id, next)
    return Promise.resolve(next)
  })

  const prisma = {
    product: {
      findMany: vi.fn().mockImplementation((args: { where?: { id?: { in: string[] } } }) => {
        const ids = args?.where?.id?.in
        const out = [...store.values()].filter((r) => !ids || ids.includes(r.id as string))
        out.sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
        return Promise.resolve(out)
      }),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(store.get(where.id) ?? null),
      ),
      update,
    },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === 'breadProductId') return Promise.resolve({ key: where.key, value: BREAD_ID })
        if (where.key === 'deliverySlots')
          return Promise.resolve({ key: where.key, value: JSON.stringify([SLOT_MANHA]) })
        return Promise.resolve(null)
      }),
    },
    // A matriz de fornecimento não é o assunto aqui — sem linhas, o custo vem null.
    supplierProduct: { findMany: vi.fn().mockResolvedValue([]) },
    supplier: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  }

  const fastify = { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance
  return { service: new AdminMarketService(fastify), store, update, prisma }
}

describe('pausa e ordem da vitrine (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(brt('2026-09-20', '09:00'))
  })
  afterEach(() => vi.useRealTimers())

  describe('pauseProduct', () => {
    it('com prazo grava pausedUntil e NÃO liga isPaused', async () => {
      const { service, store } = makeService([{ id: 'p1', name: 'Geleia' }])
      await service.pauseProduct('p1', ADMIN_ID, { minutes: 30 })

      const saved = store.get('p1')!
      expect(saved.isPaused).toBe(false)
      expect(saved.pausedUntil).toEqual(brt('2026-09-20', '09:30'))
      expect(saved.pausedBy).toBe(ADMIN_ID)
      expect(saved.pausedAt).toEqual(brt('2026-09-20', '09:00'))
    })

    it('sem prazo liga isPaused e limpa pausedUntil', async () => {
      const { service, store } = makeService([{ id: 'p1', name: 'Geleia' }])
      await service.pauseProduct('p1', ADMIN_ID, {})

      const saved = store.get('p1')!
      expect(saved.isPaused).toBe(true)
      expect(saved.pausedUntil).toBeNull()
    })

    it('guarda o motivo para o admin (o cliente nunca vê)', async () => {
      const { service, store } = makeService([{ id: 'p1', name: 'Geleia' }])
      await service.pauseProduct('p1', ADMIN_ID, { minutes: 15, reason: 'Acabou o lote' })
      expect(store.get('p1')!.pauseReason).toBe('Acabou o lote')
    })

    it('recusa pausar o Pão Francês', async () => {
      const { service } = makeService([{ id: BREAD_ID, name: 'Pão Francês' }])
      await expect(service.pauseProduct(BREAD_ID, ADMIN_ID, { minutes: 30 })).rejects.toMatchObject({
        statusCode: 409,
      })
    })

    it('404 em produto inexistente', async () => {
      const { service } = makeService([])
      await expect(service.pauseProduct('sumiu', ADMIN_ID, {})).rejects.toMatchObject({ statusCode: 404 })
    })

    it('devolve o estado já com motivo e hora da volta', async () => {
      const { service } = makeService([{ id: 'p1', name: 'Geleia' }])
      const out = await service.pauseProduct('p1', ADMIN_ID, { minutes: 30 })
      expect(out.availability).toEqual({
        state: 'pausado',
        reason: 'temporaria',
        until: brt('2026-09-20', '09:30').toISOString(),
      })
    })
  })

  describe('resumeProduct', () => {
    it('limpa a pausa inteira', async () => {
      const { service, store } = makeService([
        { id: 'p1', name: 'Geleia', isPaused: true },
      ])
      await service.resumeProduct('p1')

      const saved = store.get('p1')!
      expect(saved).toMatchObject({ isPaused: false, pausedUntil: null, pauseReason: null, pausedBy: null })
    })

    it('NÃO mexe no horário de venda — ele continua valendo', async () => {
      const { service, store } = makeService([
        { id: 'p1', name: 'Geleia', isPaused: true, availableUntil: '08:00' },
      ])
      const out = await service.resumeProduct('p1')

      expect(store.get('p1')!.availableUntil).toBe('08:00')
      // São 09:00 e a loja deste produto fecha às 08:00 → segue fechado, agora por horário.
      expect(out.availability).toMatchObject({ state: 'pausado', reason: 'horario' })
    })
  })

  describe('listProducts', () => {
    it('reporta estado, motivo e hora da volta', async () => {
      const { service } = makeService([
        { id: 'p1', name: 'Ativa' },
        { id: 'p2', name: 'Pausada', isPaused: true },
        { id: 'p3', name: 'Esgotada', stock: 0 },
        { id: 'p4', name: 'Inativa', isActive: false },
        { id: 'p5', name: 'Fora do prazo', availableUntil: '08:00' },
      ])
      const list = await service.listProducts()
      const byId = new Map(list.map((p) => [p.id, p.availability]))

      expect(byId.get('p1')).toMatchObject({ state: 'ativo' })
      expect(byId.get('p2')).toMatchObject({ state: 'pausado', reason: 'manual', until: null })
      expect(byId.get('p3')).toMatchObject({ state: 'esgotado' })
      expect(byId.get('p4')).toMatchObject({ state: 'inativo' })
      // Fecha às 08:00 e não tem reabertura própria → volta à meia-noite.
      expect(byId.get('p5')).toMatchObject({
        state: 'pausado',
        reason: 'horario',
        until: brt('2026-09-21', '00:00').toISOString(),
      })
    })

    it('isNovidade ignora selo vencido', async () => {
      const { service } = makeService([
        { id: 'p1', name: 'Vigente', isNew: true },
        { id: 'p2', name: 'Vencida', isNew: true, newUntil: brt('2026-09-19', '00:00') },
      ])
      const list = await service.listProducts()
      expect(list.find((p) => p.id === 'p1')!.isNovidade).toBe(true)
      expect(list.find((p) => p.id === 'p2')!.isNovidade).toBe(false)
    })
  })

  describe('reorderProducts', () => {
    it('grava sortOrder contínuo com as novidades na frente', async () => {
      const { service, store } = makeService([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ])
      await service.reorderProducts({ novidades: ['c'], promocoes: [], catalogo: ['b', 'a'] })

      expect(store.get('c')).toMatchObject({ isNew: true, sortOrder: 0 })
      expect(store.get('b')).toMatchObject({ isNew: false, sortOrder: 1 })
      expect(store.get('a')).toMatchObject({ isNew: false, sortOrder: 2 })
    })

    it('promover pelo arraste aplica o prazo padrão do selo', async () => {
      const { service, store } = makeService([{ id: 'a', name: 'A' }])
      await service.reorderProducts({ novidades: ['a'], promocoes: [], catalogo: [] })

      const expected = new Date(brt('2026-09-20', '09:00').getTime() + DEFAULT_NOVIDADE_DAYS * 86_400_000)
      expect(store.get('a')!.newUntil).toEqual(expected)
    })

    it('reordenar novidade existente PRESERVA o prazo já definido', async () => {
      const prazo = brt('2026-09-25', '00:00')
      const { service, store } = makeService([
        { id: 'a', name: 'A', isNew: true, newUntil: prazo },
        { id: 'b', name: 'B', isNew: true },
      ])
      await service.reorderProducts({ novidades: ['b', 'a'], promocoes: [], catalogo: [] })
      expect(store.get('a')!.newUntil).toEqual(prazo)
    })

    it('despromover limpa o selo e o prazo', async () => {
      const { service, store } = makeService([
        { id: 'a', name: 'A', isNew: true, newUntil: brt('2026-09-25', '00:00') },
      ])
      await service.reorderProducts({ novidades: [], promocoes: [], catalogo: ['a'] })
      expect(store.get('a')).toMatchObject({ isNew: false, newUntil: null })
    })

    it('ordem e selo vão na MESMA transação', async () => {
      const { service, prisma } = makeService([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
      await service.reorderProducts({ novidades: ['a'], promocoes: [], catalogo: ['b'] })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('recusa id repetido entre as listas', async () => {
      const { service } = makeService([{ id: 'a', name: 'A' }])
      await expect(service.reorderProducts({ novidades: ['a'], promocoes: [], catalogo: ['a'] })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('recusa id inexistente', async () => {
      const { service } = makeService([{ id: 'a', name: 'A' }])
      await expect(service.reorderProducts({ novidades: [], promocoes: [], catalogo: ['a', 'sumiu'] })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('ignora o Pão Francês na ordenação', async () => {
      const { service, store } = makeService([
        { id: BREAD_ID, name: 'Pão Francês' },
        { id: 'a', name: 'A' },
      ])
      await service.reorderProducts({ novidades: [BREAD_ID], promocoes: [], catalogo: ['a'] })

      expect(store.get(BREAD_ID)!.isNew).toBeNull() // não foi tocado
      expect(store.get('a')).toMatchObject({ isNew: false, sortOrder: 0 })
    })
  })

  describe('promoção', () => {
    const PROMO = { isPromo: true, promoType: 'PERCENT' as const, promoValue: 18 }

    it('grava o desconto e aplica o prazo padrão de 7 dias', async () => {
      const { service, store } = makeService([{ id: 'p1', name: 'Geleia' }])
      await service.updateProduct('p1', PROMO)

      const saved = store.get('p1')!
      expect(saved).toMatchObject({ isPromo: true, promoType: 'PERCENT', promoValue: 18 })
      expect(saved.promoUntil).toEqual(
        new Date(brt('2026-09-20', '09:00').getTime() + DEFAULT_PROMO_DAYS * 86_400_000),
      )
    })

    it('desligar limpa tipo, valor e prazo — religar não ressuscita desconto velho', async () => {
      const { service, store } = makeService([
        { id: 'p1', name: 'Geleia', ...PROMO, promoUntil: brt('2026-09-27', '09:00') },
      ])
      await service.updateProduct('p1', { isPromo: false })
      expect(store.get('p1')).toMatchObject({
        isPromo: false,
        promoType: null,
        promoValue: null,
        promoUntil: null,
      })
    })

    it('recusa desconto que zeraria o preço', async () => {
      // Produto de R$ 10 no seed.
      const { service } = makeService([{ id: 'p1', name: 'Geleia' }])
      await expect(
        service.updateProduct('p1', { isPromo: true, promoType: 'FIXED', promoValue: 10 }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('recusa percentual acima do teto', async () => {
      const { service } = makeService([{ id: 'p1', name: 'Geleia' }])
      await expect(
        service.updateProduct('p1', { isPromo: true, promoType: 'PERCENT', promoValue: 95 }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('valida contra o preço RESULTANTE quando o PATCH também baixa o preço', async () => {
      // De R$ 10 para R$ 2, com R$ 3 de desconto: válido no preço velho, absurdo no novo.
      const { service } = makeService([{ id: 'p1', name: 'Geleia' }])
      await expect(
        service.updateProduct('p1', { price: 2, isPromo: true, promoType: 'FIXED', promoValue: 3 }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('ligar sem informar tipo e valor é recusado', async () => {
      const { service } = makeService([{ id: 'p1', name: 'Geleia' }])
      await expect(service.updateProduct('p1', { isPromo: true })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('margem e belowCost saem sobre o preço EFETIVO', async () => {
      const { service, prisma } = makeService([{ id: 'p1', name: 'Geleia', ...PROMO }])
      // Custo R$ 9,00: com o preço cheio (R$ 10) haveria margem; com o promocional (R$ 8,20) não.
      ;(prisma.supplierProduct.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { productId: 'p1', supplierId: 's1', unitCost: 9, defaultSharePct: 100, isPreferred: true },
      ])
      ;(prisma.supplier.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 's1' }])

      const out = await service.getProduct('p1')
      expect(out.effectivePrice).toBe(8.2)
      expect(out.belowCost).toBe(true)
      expect(out.margin).toBeLessThan(0)
    })

    it('sem promoção, effectivePrice é o preço cheio e belowCost é falso', async () => {
      const { service } = makeService([{ id: 'p1', name: 'Geleia' }])
      const out = await service.getProduct('p1')
      expect(out.effectivePrice).toBe(10)
      expect(out.isPromoVigente).toBe(false)
      expect(out.belowCost).toBe(false)
    })
  })

  describe('reorder — balde de promoções', () => {
    const PROMO = { isPromo: true, promoType: 'PERCENT' as const, promoValue: 18 }

    it('destaca a promoção e ordena entre novidades e catálogo', async () => {
      const { service, store } = makeService([
        { id: 'nov', name: 'Nova', isNew: true },
        { id: 'pro', name: 'Promo', ...PROMO },
        { id: 'cat', name: 'Comum' },
      ])
      await service.reorderProducts({ novidades: ['nov'], promocoes: ['pro'], catalogo: ['cat'] })

      expect(store.get('nov')).toMatchObject({ isNew: true, promoPriority: false, sortOrder: 0 })
      expect(store.get('pro')).toMatchObject({ isNew: false, promoPriority: true, sortOrder: 1 })
      expect(store.get('cat')).toMatchObject({ isNew: false, promoPriority: false, sortOrder: 2 })
    })

    it('NUNCA toca no desconto — arrastar organiza vitrine, não mexe em preço', async () => {
      const prazo = brt('2026-09-27', '09:00')
      const { service, store } = makeService([
        { id: 'pro', name: 'Promo', ...PROMO, promoUntil: prazo },
      ])
      await service.reorderProducts({ novidades: [], promocoes: ['pro'], catalogo: [] })

      expect(store.get('pro')).toMatchObject({
        isPromo: true,
        promoType: 'PERCENT',
        promoValue: 18,
        promoUntil: prazo,
      })
    })

    it('tirar do destaque MANTÉM o selo', async () => {
      const { service, store } = makeService([
        { id: 'pro', name: 'Promo', ...PROMO, promoPriority: true },
      ])
      await service.reorderProducts({ novidades: [], promocoes: [], catalogo: ['pro'] })

      expect(store.get('pro')).toMatchObject({ promoPriority: false, isPromo: true, promoValue: 18 })
    })

    it('recusa destacar produto sem promoção, dizendo onde resolver', async () => {
      const { service } = makeService([{ id: 'sem', name: 'Sem desconto' }])
      const err = await service
        .reorderProducts({ novidades: [], promocoes: ['sem'], catalogo: [] })
        .catch((e: { statusCode: number; message: string }) => e)

      expect(err).toMatchObject({ statusCode: 400 })
      expect((err as { message: string }).message).toContain('Sem desconto')
      expect((err as { message: string }).message).toMatch(/desconto/i)
    })

    it('recusa destacar promoção vencida', async () => {
      const { service } = makeService([
        { id: 'pro', name: 'Venceu', ...PROMO, promoUntil: brt('2026-09-19', '00:00') },
      ])
      await expect(
        service.reorderProducts({ novidades: [], promocoes: ['pro'], catalogo: [] }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('id repetido entre quaisquer dois baldes é recusado', async () => {
      const { service } = makeService([{ id: 'pro', name: 'Promo', ...PROMO }])
      await expect(
        service.reorderProducts({ novidades: ['pro'], promocoes: ['pro'], catalogo: [] }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('os três baldes vão na MESMA transação', async () => {
      const { service, prisma } = makeService([
        { id: 'nov', name: 'Nova' },
        { id: 'pro', name: 'Promo', ...PROMO },
        { id: 'cat', name: 'Comum' },
      ])
      await service.reorderProducts({ novidades: ['nov'], promocoes: ['pro'], catalogo: ['cat'] })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateProduct — horário de venda', () => {
    it('ACEITA janela que cruza a meia-noite (fecha 20:00, reabre 22:00)', async () => {
      // Era recusado enquanto o horário era corte por ciclo; com relógio de loja é legítimo.
      const { service, store } = makeService([{ id: 'p1', name: 'Geleia', availableUntil: '20:00' }])
      await service.updateProduct('p1', { availableFrom: '22:00' })
      expect(store.get('p1')).toMatchObject({ availableFrom: '22:00', availableUntil: '20:00' })
    })

    it('aceita janela normal', async () => {
      const { service, store } = makeService([{ id: 'p1', name: 'Geleia', availableUntil: '18:00' }])
      await service.updateProduct('p1', { availableFrom: '14:00' })
      expect(store.get('p1')).toMatchObject({ availableFrom: '14:00', availableUntil: '18:00' })
    })

    it('recusa fechar e reabrir na MESMA hora', async () => {
      // Duração zero ou 24h — ambíguo, e não há resposta certa para escolher em silêncio.
      const { service } = makeService([{ id: 'p1', name: 'Geleia', availableUntil: '20:00' }])
      await expect(service.updateProduct('p1', { availableFrom: '20:00' })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('limpar uma ponta é válido', async () => {
      const { service, store } = makeService([
        { id: 'p1', name: 'Geleia', availableUntil: '06:00' },
      ])
      await service.updateProduct('p1', { availableUntil: null, availableFrom: '10:00' })
      expect(store.get('p1')).toMatchObject({ availableFrom: '10:00', availableUntil: null })
    })
  })
})
