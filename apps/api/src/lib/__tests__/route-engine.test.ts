// Motor de rota (T-8): ordem ótima com matriz simulada, 2-opt acima de 8 prédios, sem base,
// OSRM fora do ar e prédio sem coordenada; encaixe de menor desvio (rota padrão).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cheapestInsertion, clearRouteCache, computeEtas, insertStops, pathCost, planRoute, routeMetrics, solveOrder } from '../route-engine.js'

// Pontos numa reta: o custo entre i e j é |xi - xj|. A melhor ordem saindo da base (x=0) é crescente.
const line = (xs: number[]) => xs.map((x) => xs.map((y) => Math.abs(x - y)))

describe('solveOrder', () => {
  it('exata até 8: sai da base e visita em ordem de distância', () => {
    const cost = line([0, 5, 1, 3, 2])
    expect(solveOrder(cost, [1, 2, 3, 4], 0, false)).toEqual([2, 4, 3, 1])
  })

  it('volta à base muda o custo, não a validade da ordem', () => {
    const cost = line([0, 5, 1, 3, 2])
    const seq = solveOrder(cost, [1, 2, 3, 4], 0, true)
    expect(pathCost(cost, seq, 0, true)).toBe(10)
  })

  it('sem base: o primeiro prédio é livre', () => {
    const cost = line([9, 1, 5, 3])
    const seq = solveOrder(cost, [0, 1, 2, 3], null, false)
    expect(pathCost(cost, seq, null, false)).toBe(8)
  })

  it('acima de 8 prédios: vizinho mais próximo + 2-opt chega na ordem ótima da reta', () => {
    const xs = [0, 7, 2, 9, 4, 1, 8, 3, 6, 5, 10]
    const cost = line(xs)
    const nodes = xs.map((_, i) => i).slice(1)
    const seq = solveOrder(cost, nodes, 0, false)
    expect(seq.map((n) => xs[n])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('quadrado com volta à base: escolhe a ordem sem cruzamento', () => {
    // Quadrado: 0(0,0) 1(0,1) 2(1,1) 3(1,0) — a ordem 0→2→1→3 cruza; 0→1→2→3 não.
    const p = [[0, 0], [0, 1], [1, 1], [1, 0]]
    const cost = p.map((a) => p.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])))
    const seq = solveOrder(cost, [1, 2, 3], 0, true)
    expect(pathCost(cost, seq, 0, true)).toBeCloseTo(4)
  })
})

describe('cheapestInsertion', () => {
  it('encaixa no vão de menor desvio, sem mexer no resto', () => {
    // Reta: base 0, prédios 2 e 6; o novo (4) cabe entre eles sem custo extra.
    const cost = line([0, 2, 6, 4])
    expect(cheapestInsertion(cost, [1, 2], 3, 0, false)).toEqual({ index: 1, delta: 0 })
  })

  it('vão no começo (logo depois da base) e no fim', () => {
    const cost = line([0, 5, 6, 1, 9])
    expect(cheapestInsertion(cost, [1, 2], 3, 0, false).index).toBe(0)
    expect(cheapestInsertion(cost, [1, 2], 4, 0, false)).toEqual({ index: 2, delta: 3 })
  })

  it('com volta à base, o último vão volta para ela', () => {
    // O novo (3) fica perto da base: sem a volta, entra logo depois dela; com a volta, no fim
    // (2→3→base sai mais barato que 2→base).
    const cost = [
      [0, 1, 3, 1],
      [1, 0, 1, 2],
      [3, 1, 0, 3],
      [1, 2, 3, 0],
    ]
    expect(cheapestInsertion(cost, [1, 2], 3, 0, false)).toEqual({ index: 0, delta: 2 })
    expect(cheapestInsertion(cost, [1, 2], 3, 0, true)).toEqual({ index: 2, delta: 1 })
  })

  it('sem base: antes do 1º custa só a perna nova', () => {
    const cost = line([5, 6, 1])
    expect(cheapestInsertion(cost, [0, 1], 2, null, false)).toEqual({ index: 0, delta: 4 })
  })

  it('par sem caminho (1e9) é evitado', () => {
    const cost = line([0, 2, 6, 4])
    cost[1][3] = 1e9
    expect(cheapestInsertion(cost, [1, 2], 3, 0, false).index).toBe(2)
  })
})

describe('planRoute / routeMetrics (OSRM simulado)', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    clearRouteCache()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'Ok', ...(body as object) }) })
  const base = { lat: 0, lng: 0 }
  const stops = [
    { id: 'far', lat: 0, lng: 0.03 },
    { id: 'near', lat: 0, lng: 0.01 },
    { id: 'mid', lat: 0, lng: 0.02 },
  ]

  it('ordena pela matriz e mede a rota na ordem escolhida', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/table/')) return ok({ durations: line([0, 30, 10, 20]) })
      return ok({ routes: [{ distance: 6200, duration: 600, geometry: { coordinates: [[0, 0], [0.01, 0]] }, legs: [{ duration: 100 }, { duration: 100 }, { duration: 100 }, { duration: 300 }] }] })
    })
    const plan = await planRoute({ base, stops, returnToBase: false })
    expect(plan.order).toEqual(['near', 'mid', 'far'])
    expect(plan.km).toBe(6.2)
    expect(plan.durationMin).toBe(10)
    expect(plan.legSeconds).toHaveLength(4)
    expect(plan.geometry[0]).toEqual([0, 0])
    const routeUrl = fetchMock.mock.calls.find(([u]) => u.includes('/route/'))![0] as string
    // base → near → mid → far
    expect(routeUrl).toContain('/driving/0.000000,0.000000;0.010000,0.000000;0.020000,0.000000;0.030000,0.000000?')
  })

  it('volta à base: o traçado termina na base', async () => {
    fetchMock.mockImplementation(() => ok({ routes: [{ distance: 1000, duration: 60, legs: [] }] }))
    await routeMetrics({ base, stops: [stops[1]], returnToBase: true })
    expect(fetchMock.mock.calls[0][0]).toContain('/driving/0.000000,0.000000;0.010000,0.000000;0.000000,0.000000?')
  })

  it('OSRM fora do ar: devolve a ordem recebida sem métricas (a lista segue sem mapa)', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    const plan = await planRoute({ base, stops, returnToBase: false })
    expect(plan.order).toEqual(['far', 'near', 'mid'])
    expect(plan.km).toBeNull()
    expect(plan.geometry).toEqual([])
  })

  it('prédio sem coordenada fica no fim e fora do traçado', async () => {
    fetchMock.mockImplementation((url: string) => (url.includes('/table/') ? ok({ durations: line([0, 30, 10]) }) : ok({ routes: [{ distance: 1000, duration: 60, legs: [] }] })))
    const plan = await planRoute({ base, stops: [stops[0], { id: 'nomap', lat: null, lng: null }, stops[1]], returnToBase: false })
    expect(plan.order).toEqual(['near', 'far', 'nomap'])
  })

  it('insertStops: encaixa pela matriz sem reordenar; sem coordenada fica de fora', async () => {
    fetchMock.mockImplementation(() => ok({ durations: line([0, 10, 30, 20]) }))
    const res = await insertStops({ base, order: [stops[1], stops[0]], add: [stops[2], { id: 'nomap', lat: null, lng: null }], returnToBase: false })
    expect(res).toEqual({ order: ['near', 'mid', 'far'], computed: true })
    expect(fetchMock.mock.calls[0][0]).toContain('/table/v1/driving/0.000000,0.000000;0.010000,0.000000;0.030000,0.000000;0.020000,0.000000?')
  })

  it('insertStops: OSRM fora → a ordem recebida e computed false; nada a encaixar → sem chamada', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    expect(await insertStops({ base, order: [stops[1]], add: [stops[2]], returnToBase: true })).toEqual({ order: ['near'], computed: false })
    fetchMock.mockClear()
    expect(await insertStops({ base, order: [stops[1]], add: [], returnToBase: true })).toEqual({ order: ['near'], computed: true })
    expect(await insertStops({ base: null, order: [], add: [stops[0]], returnToBase: false })).toEqual({ order: ['far'], computed: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cache: a mesma rota não chama o OSRM de novo', async () => {
    fetchMock.mockImplementation(() => ok({ routes: [{ distance: 1000, duration: 60, legs: [] }] }))
    await routeMetrics({ base: null, stops, returnToBase: false })
    await routeMetrics({ base: null, stops, returnToBase: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('menos de 2 pontos: sem chamada e sem métricas', async () => {
    const m = await routeMetrics({ base: null, stops: [stops[0]], returnToBase: false })
    expect(m.km).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('computeEtas', () => {
  const now = new Date('2026-10-02T09:00:00.000Z') // 06:00 BRT
  const base = {
    order: ['a', 'b', 'c'],
    legSeconds: [600, 300, 300],
    hasBase: true,
    locatedIds: new Set(['a', 'b', 'c']),
    doorsByCondo: new Map([['a', 4], ['b', 2], ['c', 1]]),
    minPerDoor: 1,
    startAt: now,
    now,
    doneIds: new Set<string>(),
  }

  it('trajeto + tempo por porta, a partir do início', () => {
    const etas = computeEtas(base)
    // a: 06:00+10 = 06:10; b: +4 portas +5 = 06:19; c: +2 +5 = 06:26
    expect([...etas.values()]).toEqual(['06:10', '06:19', '06:26'])
  })

  it('atrasado: as paradas pendentes são empurradas para depois de agora', () => {
    const etas = computeEtas({ ...base, startAt: new Date('2026-10-02T08:00:00.000Z'), doneIds: new Set(['a']) })
    // a feito (05:10). b seria 05:19 → empurrado para 06:00; c +7 min → 06:07
    expect(etas.get('a')).toBe('05:10')
    expect(etas.get('b')).toBe('06:00')
    expect(etas.get('c')).toBe('06:07')
  })

  it('prédio sem mapa não tem hora; sem base o 1º é a partida', () => {
    const etas = computeEtas({ ...base, hasBase: false, legSeconds: [300], order: ['a', 'x', 'b'], locatedIds: new Set(['a', 'b']) })
    expect(etas.get('a')).toBe('06:00')
    expect(etas.get('x')).toBeNull()
    expect(etas.get('b')).toBe('06:09')
  })
})
