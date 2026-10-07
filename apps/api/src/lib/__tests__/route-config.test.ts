import { describe, it, expect, vi } from 'vitest'
import { getRouteConfig, setRouteConfig, ROUTE_SETTING_KEYS } from '../route-config.js'

function prismaWith(rows: Record<string, string>) {
  const store = new Map(Object.entries(rows))
  const prisma = {
    setting: {
      findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
        where.key.in.filter((k) => store.has(k)).map((key) => ({ key, value: store.get(key)! })),
      ),
      upsert: vi.fn(async ({ where, create, update }: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
        store.set(where.key, store.has(where.key) ? update.value : create.value)
        return {}
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  }
  return { prisma, store }
}

describe('getRouteConfig', () => {
  it('sem nada configurado: sem base, sem preço, padrões de cálculo', async () => {
    const { prisma } = prismaWith({})
    expect(await getRouteConfig(prisma as never)).toEqual({
      base: null,
      voltaBase: true,
      minPorPorta: 1,
      precoGasolina: null,
      precoEtanol: null,
      precoGnv: null,
      precoAtualizadoEm: null,
      fotoClienteVisivel: true,
      // O que o entregador vê (Onda 10): os três nascem escondidos
      entregadorVeCombNumeros: false,
      entregadorVeCombFimRota: false,
      entregadorVeCombGanhos: false,
    })
  })

  it('lê os valores gravados', async () => {
    const { prisma } = prismaWith({
      rotaBaseEndereco: 'Rua das Flores, 120',
      rotaBaseLat: '-23.5618',
      rotaBaseLng: '-46.6588',
      rotaVoltaBase: 'false',
      rotaMinPorPorta: '2',
      combustivelGasolina: '6.09',
      combustivelEtanol: '4.19',
      combustivelGnv: '4.99',
      combustivelAtualizadoEm: '2026-09-28',
      fotoClienteVisivel: 'false',
      entregadorVeCombNumeros: 'true',
      entregadorVeCombFimRota: 'true',
      entregadorVeCombGanhos: 'false',
    })
    expect(await getRouteConfig(prisma as never)).toEqual({
      base: { endereco: 'Rua das Flores, 120', lat: -23.5618, lng: -46.6588 },
      voltaBase: false,
      minPorPorta: 2,
      precoGasolina: 6.09,
      precoEtanol: 4.19,
      precoGnv: 4.99,
      precoAtualizadoEm: '2026-09-28',
      fotoClienteVisivel: false,
      entregadorVeCombNumeros: true,
      entregadorVeCombFimRota: true,
      entregadorVeCombGanhos: false,
    })
  })

  it('valor inválido cai no padrão; base pela metade não vale', async () => {
    const { prisma } = prismaWith({
      rotaBaseEndereco: 'Rua A',
      rotaBaseLat: '-23.5',
      rotaBaseLng: '', // falta
      rotaMinPorPorta: '99',
      combustivelGasolina: '0',
      rotaVoltaBase: 'talvez',
    })
    const c = await getRouteConfig(prisma as never)
    expect(c.base).toBeNull()
    expect(c.minPorPorta).toBe(1)
    expect(c.precoGasolina).toBeNull()
    expect(c.voltaBase).toBe(true)
  })
})

describe('setRouteConfig', () => {
  const body = {
    base: { endereco: 'Rua das Flores, 120', lat: -23.5, lng: -46.6 },
    voltaBase: true,
    minPorPorta: 1,
    precoGasolina: 6.09,
    precoEtanol: 4.19,
    fotoClienteVisivel: true,
  }
  const now = new Date('2026-10-01T15:00:00Z')

  it('preço mudou: data do preço vira hoje (BRT)', async () => {
    const { prisma } = prismaWith({ combustivelGasolina: '5.99', combustivelAtualizadoEm: '2026-09-01' })
    const saved = await setRouteConfig(prisma as never, body, now)
    expect(saved.precoAtualizadoEm).toBe('2026-10-01')
    expect(saved.base).toEqual(body.base)
  })

  it('preço igual: mantém a data antiga (salvar a base não "atualiza o preço")', async () => {
    const { prisma } = prismaWith({ combustivelGasolina: '6.09', combustivelEtanol: '4.19', combustivelAtualizadoEm: '2026-09-01' })
    const saved = await setRouteConfig(prisma as never, body, now)
    expect(saved.precoAtualizadoEm).toBe('2026-09-01')
  })

  it('base null e preço null gravam vazio (= não configurado)', async () => {
    const { prisma, store } = prismaWith({ rotaBaseEndereco: 'Rua A', rotaBaseLat: '1', rotaBaseLng: '2', combustivelEtanol: '4.19' })
    const saved = await setRouteConfig(prisma as never, { ...body, base: null, precoEtanol: null }, now)
    expect(saved.base).toBeNull()
    expect(saved.precoEtanol).toBeNull()
    expect(store.get(ROUTE_SETTING_KEYS.baseEndereco)).toBe('')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('GNV (Onda 11): ausente no corpo mantém o preço; mudar o preço do GNV atualiza a data', async () => {
    const { prisma } = prismaWith({ combustivelGasolina: '6.09', combustivelEtanol: '4.19', combustivelGnv: '4.99', combustivelAtualizadoEm: '2026-09-01' })
    const kept = await setRouteConfig(prisma as never, body, now)
    expect(kept).toMatchObject({ precoGnv: 4.99, precoAtualizadoEm: '2026-09-01' })
    const changed = await setRouteConfig(prisma as never, { ...body, precoGnv: 5.19 }, now)
    expect(changed).toMatchObject({ precoGnv: 5.19, precoAtualizadoEm: '2026-10-01' })
    expect((await setRouteConfig(prisma as never, { ...body, precoGnv: null }, now)).precoGnv).toBeNull()
  })

  it('switches do entregador ausentes no corpo mantêm o gravado (T-19); presentes, gravam', async () => {
    const { prisma, store } = prismaWith({ entregadorVeCombNumeros: 'true', entregadorVeCombGanhos: 'false' })
    const kept = await setRouteConfig(prisma as never, body, now)
    expect(kept).toMatchObject({ entregadorVeCombNumeros: true, entregadorVeCombFimRota: false, entregadorVeCombGanhos: false })
    const changed = await setRouteConfig(prisma as never, { ...body, entregadorVeCombFimRota: true, entregadorVeCombGanhos: true }, now)
    expect(changed).toMatchObject({ entregadorVeCombNumeros: true, entregadorVeCombFimRota: true, entregadorVeCombGanhos: true })
    expect(store.get(ROUTE_SETTING_KEYS.entregadorVeCombFimRota)).toBe('true')
  })
})
