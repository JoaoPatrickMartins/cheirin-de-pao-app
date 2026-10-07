// Rota padrão (plano-rota-padrao): a tela (1ª vez já sugere, comparação, editar, encaixes para
// revisar, fora do mapa, mapa fora do ar), o card da A5 e a A4 com a rota padrão.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../courier/CourierMap', () => ({
  CourierMap: ({ stops }: { stops: Array<{ id: string }> }) => <div data-testid="map">{stops.map((s) => s.id).join(',')}</div>,
}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet">{children}</div>,
  TileLayer: () => null,
  Marker: () => <span>pino</span>,
  useMap: () => ({ setView: vi.fn() }),
}))

import { DefaultRouteScreen } from '../DefaultRouteScreen'
import { CourierRouteScreen } from '../CourierRouteScreen'
import { AdminRotasConfig } from '../../../pages/admin/gestao/AdminRotasConfig'

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
const method = (o?: { method?: string }) => o?.method ?? 'GET'
const bodyOf = (m: string, url: string) => JSON.parse(mockApiFetch.mock.calls.find(([u, o]) => u === url && method(o) === m)![1].body)

const condos = [
  { id: 'cA', name: 'Residencial Jardins', lat: -23.5, lng: -46.6, approxLocation: false, flag: null, kmAdded: null },
  { id: 'cB', name: 'Edifício Aurora', lat: -23.6, lng: -46.7, approxLocation: true, flag: null, kmAdded: null },
  { id: 'cN', name: 'Parque das Águas', lat: -23.55, lng: -46.65, approxLocation: false, flag: 'NOVO', kmAdded: 0.8 },
]
const base = { endereco: 'Padaria', lat: -23.5, lng: -46.6 }
const saved = { condominiumIds: ['cB', 'cN', 'cA'], km: 9.2, durationMin: 70, geometry: [], savedAt: '2026-10-06T15:00:00.000Z', savedByName: 'João Martins' }
const view = { base, voltaBase: true, saved, condos, outside: [] }
const suggestion = { condominiumIds: ['cA', 'cN', 'cB'], km: 8.1, durationMin: 64, geometry: [], computed: true, deltaKm: -1.1 }

beforeEach(() => {
  mockApiFetch.mockReset()
})

describe('Rota padrão · tela', () => {
  it('1ª vez: já abre com a sugestão; "Usar sugestão" salva a ordem', async () => {
    const first = { ...view, saved: null, condos: condos.map((c) => ({ ...c, flag: null })) }
    mockApiFetch.mockImplementation((url: string, o?: { method?: string; body?: string }) => {
      if (url === '/admin/default-route/suggest') return ok({ ...suggestion, deltaKm: null })
      if (url === '/admin/default-route' && method(o) === 'PUT') return ok({ ...first, saved: { ...saved, condominiumIds: JSON.parse(o!.body!).condominiumIds } })
      return ok(first)
    })
    render(<DefaultRouteScreen onBack={vi.fn()} />)
    expect(await screen.findByText('Primeira sugestão')).toBeDefined()
    expect(screen.getByText('A melhor ordem para os 3 condomínios ativos, saindo da base e voltando para ela.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Usar sugestão/ }))
    expect(await screen.findByText('Rota padrão salva. Vale para os entregadores sem rota própria a partir da próxima rota.')).toBeDefined()
    expect(bodyOf('PUT', '/admin/default-route')).toEqual({ condominiumIds: ['cA', 'cN', 'cB'] })
  })

  it('salva: resumo, quem salvou, selos e o aviso do encaixe; "Está bom assim" revisa', async () => {
    mockApiFetch.mockImplementation((url: string) =>
      url === '/admin/default-route/review' ? ok({ ...view, condos: condos.map((c) => ({ ...c, flag: null, kmAdded: null })) }) : ok(view),
    )
    render(<DefaultRouteScreen onBack={vi.fn()} />)
    expect(await screen.findByText('ROTA PADRÃO · 3 PRÉDIOS')).toBeDefined()
    expect(screen.getByText('salva em 06/10 por João')).toBeDefined()
    expect(screen.getByText('1 prédio entrou sozinho')).toBeDefined()
    expect(screen.getByText(/entrou na posição 2 \(\+0,8 km\)\./)).toBeDefined()
    expect(screen.getByText('novo · encaixado')).toBeDefined()
    expect(screen.getByText('aproximado')).toBeDefined()
    expect(mockApiFetch).not.toHaveBeenCalledWith('/admin/default-route/suggest', expect.anything())
    fireEvent.click(screen.getByRole('button', { name: /Está bom assim/ }))
    await waitFor(() => expect(screen.queryByText('1 prédio entrou sozinho')).toBeNull())
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/default-route/review', { method: 'POST' })
    expect(screen.queryByText('novo · encaixado')).toBeNull()
  })

  it('Sugerir rota: atual × sugerida no mapa, −km, subiu/desceu; Descartar volta para a salva', async () => {
    mockApiFetch.mockImplementation((url: string) => ok(url === '/admin/default-route/suggest' ? suggestion : view))
    render(<DefaultRouteScreen onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Sugerir rota/ }))
    expect(await screen.findByText('Rota sugerida')).toBeDefined()
    expect(screen.getByText('−1,1 km')).toBeDefined()
    expect(screen.getByText('1,1 km a menos que a atual, com os mesmos prédios.')).toBeDefined()
    expect(screen.getByText('subiu 2')).toBeDefined()
    expect(screen.getByText('desceu 2')).toBeDefined()
    expect(screen.getByTestId('map').textContent).toBe('cA,cN,cB')
    fireEvent.click(screen.getByRole('tab', { name: 'Atual · 9,2 km' }))
    expect(screen.getByTestId('map').textContent).toBe('cB,cN,cA')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.queryByText('Rota sugerida')).toBeNull()
    expect(screen.getByText('ROTA PADRÃO · 3 PRÉDIOS')).toBeDefined()
    expect(mockApiFetch.mock.calls.some(([u, o]) => u === '/admin/default-route' && method(o) === 'PUT')).toBe(false)
  })

  it('"Editar antes de usar": lista arrastável a partir da sugestão; "Salvar rota padrão" manda a ordem', async () => {
    mockApiFetch.mockImplementation((url: string, o?: { method?: string }) => ok(url === '/admin/default-route/suggest' ? suggestion : method(o) === 'PUT' ? view : view))
    render(<DefaultRouteScreen onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Sugerir rota/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Editar antes de usar/ }))
    expect(screen.getByText('Arraste para mudar a ordem. O km e o tempo recalculam na hora.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Arrastar Parque das Águas' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Salvar rota padrão/ }))
    await waitFor(() => expect(mockApiFetch.mock.calls.some(([u, o]) => u === '/admin/default-route' && method(o) === 'PUT')).toBe(true))
    expect(bodyOf('PUT', '/admin/default-route')).toEqual({ condominiumIds: ['cA', 'cN', 'cB'] })
  })

  it('1ª vez com o mapa fora do ar: aviso, tentar de novo e montar à mão', async () => {
    const first = { ...view, saved: null }
    mockApiFetch.mockImplementation((url: string) => ok(url === '/admin/default-route/suggest' ? { ...suggestion, computed: false, km: null } : first))
    render(<DefaultRouteScreen onBack={vi.fn()} />)
    expect(await screen.findByText(/o mapa está fora do ar/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Montar à mão/ }))
    expect(screen.getByRole('button', { name: 'Arrastar Residencial Jardins' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Salvar rota padrão/ }))
    await waitFor(() => expect(bodyOf('PUT', '/admin/default-route')).toEqual({ condominiumIds: ['cA', 'cB', 'cN'] }))
  })

  it('sem base e com prédio sem localização: avisos e o atalho para Condomínios', async () => {
    const onOpenCondos = vi.fn()
    mockApiFetch.mockImplementation(() => ok({ ...view, base: null, outside: [{ id: 'cX', name: 'Vila Nova' }] }))
    render(<DefaultRouteScreen onBack={vi.fn()} onOpenCondos={onOpenCondos} />)
    expect(await screen.findByText('Sem base de saída: a rota começa no primeiro prédio. Defina a base em Rotas e comprovante.')).toBeDefined()
    expect(screen.getByText('Fora do mapa · 1')).toBeDefined()
    expect(screen.getByText('Vila Nova')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Corrigir em Condomínios/ }))
    expect(onOpenCondos).toHaveBeenCalled()
  })
})

describe('A5 · card da rota padrão', () => {
  const cfg = { base, voltaBase: true, minPorPorta: 1, precoGasolina: 6.09, precoEtanol: null, precoAtualizadoEm: null, fotoClienteVisivel: true, entregadorVeCombNumeros: false, entregadorVeCombFimRota: false, entregadorVeCombGanhos: false, storageConfigured: true }

  it('sem rota padrão: convida a montar; abre a tela e, ao voltar, atualiza só o resumo', async () => {
    let summary: unknown = null
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/admin/settings/rotas') return ok({ ...cfg, rotaPadrao: summary })
      if (url === '/admin/default-route/suggest') return ok(suggestion)
      return ok({ ...view, saved: null })
    })
    render(<AdminRotasConfig onBack={vi.fn()} />)
    expect(await screen.findByText('Sem rota padrão ainda')).toBeDefined()
    fireEvent.click(screen.getByText('Montar rota padrão'))
    expect(await screen.findByRole('heading', { name: 'Rota padrão' })).toBeDefined()
    summary = { count: 3, km: 7.4, durationMin: 31, savedAt: '2026-10-06T15:00:00.000Z', toReview: 0, outside: 0 }
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(await screen.findByText('3 prédios · ~7,4 km · ~31 min')).toBeDefined()
  })

  it('com rota padrão: resumo e selos; mexer na volta sem salvar mostra o aviso', async () => {
    mockApiFetch.mockImplementation(() => ok({ ...cfg, rotaPadrao: { count: 3, km: 7.4, durationMin: 31, savedAt: '2026-10-06T15:00:00.000Z', toReview: 2, outside: 1 } }))
    render(<AdminRotasConfig onBack={vi.fn()} />)
    expect(await screen.findByText('3 prédios · ~7,4 km · ~31 min')).toBeDefined()
    expect(screen.getByText('Salva em 06/10 · base das rotas de todos os turnos')).toBeDefined()
    expect(screen.getByText('2 para revisar')).toBeDefined()
    expect(screen.getByText('1 fora do mapa')).toBeDefined()
    expect(screen.queryByText(/Salve antes de mexer na rota padrão/)).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Contar a volta à base no km' }))
    expect(screen.getByText('Salve antes de mexer na rota padrão: ela usa a base e a volta já salvas.')).toBeDefined()
  })
})

describe('A4 · com a rota padrão', () => {
  const a4 = {
    courier: { id: 'k1', name: 'Antônio Ribeiro' },
    slot: { slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30' },
    base: null,
    condos: condos.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })),
    saved: null,
    suggestion: null,
    changes: [],
    followsDefault: true,
    defaultOrder: { condominiumIds: ['cB', 'cA'], km: 6.3, durationMin: 40, geometry: [] },
  }

  it('sem rota própria: segue a padrão com os prédios do turno; Ajustar cria a rota própria', async () => {
    mockApiFetch.mockImplementation(() => ok(a4))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    expect(await screen.findByText('Segue a rota padrão')).toBeDefined()
    expect(screen.getByText('SEGUE A ROTA PADRÃO')).toBeDefined()
    expect(screen.getByText('~6,3 km · ~40 min')).toBeDefined()
    expect(screen.queryByText(/Ainda não há rota para este turno/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ajustar/ }))
    expect(screen.getByRole('button', { name: 'Arrastar Edifício Aurora' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Salvar rota/ }))
    await waitFor(() => expect(bodyOf('PUT', '/admin/couriers/k1/routes/manha')).toEqual({ condominiumIds: ['cB', 'cA'] }))
  })

  it('sem entregas no turno: segue a padrão, sem lista', async () => {
    mockApiFetch.mockImplementation(() => ok({ ...a4, defaultOrder: { condominiumIds: [], km: null, durationMin: null, geometry: [] } }))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    expect(await screen.findByText('Ainda sem entregas neste turno. Antônio segue a rota padrão.')).toBeDefined()
  })

  it('rota própria: selo, "Voltar à rota padrão" com confirmação e o aviso de pronto', async () => {
    const own = { ...a4, followsDefault: false, saved: { condominiumIds: ['cA', 'cB'], km: 9.2, durationMin: 70, geometry: [], acceptedAt: '2026-09-15T12:00:00Z' }, changes: [{ runId: 'r1', date: '2026-09-26', condominiumIds: ['cB', 'cA'], km: 9.8, description: 'Trocou' }] }
    mockApiFetch.mockImplementation((url: string) => ok(url.endsWith('/reset') ? a4 : own))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    expect(await screen.findByText('Rota própria')).toBeDefined()
    expect(screen.getByText('ROTA PRÓPRIA')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Adotar como rota própria' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Voltar à rota padrão/ }))
    expect(screen.getByText(/A rota própria de Antônio · Manhã sai/)).toBeDefined()
    expect(mockApiFetch).not.toHaveBeenCalledWith('/admin/couriers/k1/routes/manha/reset', expect.anything())
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à rota padrão' }))
    expect(await screen.findByText('Pronto: Antônio · Manhã volta a seguir a rota padrão a partir da próxima rota.')).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/couriers/k1/routes/manha/reset', { method: 'POST' })
    expect(screen.getByText('Segue a rota padrão')).toBeDefined()
  })
})
