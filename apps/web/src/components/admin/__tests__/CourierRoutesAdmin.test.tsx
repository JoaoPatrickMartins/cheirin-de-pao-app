// Admin · rotas dos entregadores (Onda 5): A5 Rotas e comprovante, A4 Rota do entregador e A2
// mapa ao vivo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../courier/CourierMap', () => ({
  CourierMap: ({ stops, couriers }: { stops: Array<{ id: string; done?: boolean }>; couriers?: Array<{ initials: string; stale?: boolean }> }) => (
    <div data-testid="map">
      {stops.length} prédios{(couriers ?? []).map((c) => ` · ${c.initials}${c.stale ? ' (velha)' : ''}`)}
    </div>
  ),
}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet">{children}</div>,
  TileLayer: () => null,
  Marker: () => <span>pino</span>,
  useMap: () => ({ setView: vi.fn() }),
}))

import { AdminRotasConfig } from '../../../pages/admin/gestao/AdminRotasConfig'
import { CourierRouteScreen } from '../CourierRouteScreen'
import { LiveRoutesCard } from '../LiveRoutesCard'

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
const bad = (status: number, body: unknown) => Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  mockApiFetch.mockReset()
})

describe('A5 · Rotas e comprovante', () => {
  const cfg = { base: null, voltaBase: true, minPorPorta: 1, precoGasolina: 6.09, precoEtanol: null, precoAtualizadoEm: '2026-09-28', fotoClienteVisivel: true, entregadorVeCombNumeros: false, entregadorVeCombFimRota: false, entregadorVeCombGanhos: false, storageConfigured: false }

  it('sem base: aviso; sem S3: aviso de armazenamento; busca o endereço e escolhe → mapa com o pino', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/admin/settings/rotas') return ok(cfg)
      if (url.startsWith('/admin/geocode')) return ok({ results: [{ label: 'Rua das Flores, 120, Centro', lat: -23.5, lng: -46.6 }] })
      return ok({})
    })
    render(<AdminRotasConfig onBack={vi.fn()} />)
    expect(await screen.findByText('Base não definida: a rota começa no primeiro prédio e não conta a ida.')).toBeDefined()
    expect(screen.getByText(/Armazenamento de fotos não configurado/)).toBeDefined()
    expect(screen.getByText('atualizado em 28/09')).toBeDefined()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar endereço da base' }), { target: { value: 'Rua das Flores' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Rua das Flores, 120, Centro' }, { timeout: 2000 }))
    expect(screen.getByText('Arraste o pino para ajustar a posição exata.')).toBeDefined()
    expect(screen.getByTestId('leaflet')).toBeDefined()
  })

  it('salvar manda a config inteira (preço com vírgula vira número; vazio = não informado)', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      if (url === '/admin/settings/rotas' && opts?.method === 'PATCH') return ok({ ...cfg, ...JSON.parse(opts.body!) })
      if (url === '/admin/settings/rotas') return ok(cfg)
      return ok({})
    })
    render(<AdminRotasConfig onBack={vi.fn()} />)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Preço do litro · Etanol' }), { target: { value: '4,19' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mais um minuto' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Cliente vê a foto da entrega' }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(await screen.findByText(/Salvo às/)).toBeDefined()
    const body = JSON.parse(mockApiFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')![1].body)
    expect(body).toEqual({ base: null, voltaBase: true, minPorPorta: 2, precoGasolina: 6.09, precoEtanol: 4.19, precoGnv: null, fotoClienteVisivel: false, entregadorVeCombNumeros: false, entregadorVeCombFimRota: false, entregadorVeCombGanhos: false })
  })

  it('GNV (Onda 11): preço por m³ vai no salvar; fora da faixa, a mensagem do m³', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      if (url === '/admin/settings/rotas' && opts?.method === 'PATCH') return ok({ ...cfg, ...JSON.parse(opts.body!) })
      if (url === '/admin/settings/rotas') return ok({ ...cfg, precoGnv: 4.79 })
      return ok({})
    })
    render(<AdminRotasConfig onBack={vi.fn()} />)
    const gnv = await screen.findByRole('textbox', { name: 'Preço do m³ · GNV' })
    expect((gnv as HTMLInputElement).value).toBe('4,79')
    expect(screen.getByText('R$/m³')).toBeDefined()
    fireEvent.change(gnv, { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(await screen.findByText('Preço do m³ do GNV entre R$ 0,01 e R$ 20,00.')).toBeDefined()
    fireEvent.change(gnv, { target: { value: '4,99' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(await screen.findByText(/Salvo às/)).toBeDefined()
    expect(JSON.parse(mockApiFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')![1].body).precoGnv).toBe(4.99)
  })

  it('"O que o entregador vê": os três nascem desligados e vão no salvar', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
      if (url === '/admin/settings/rotas' && opts?.method === 'PATCH') return ok({ ...cfg, ...JSON.parse(opts.body!) })
      if (url === '/admin/settings/rotas') return ok(cfg)
      return ok({})
    })
    render(<AdminRotasConfig onBack={vi.fn()} />)
    const numeros = await screen.findByRole('switch', { name: 'Km e combustível em Meus números' })
    const fimRota = screen.getByRole('switch', { name: 'Km e combustível no Fim da rota' })
    const ganhos = screen.getByRole('switch', { name: 'Conta do combustível em Meus ganhos' })
    expect([numeros, fimRota, ganhos].map((el) => el.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false'])
    fireEvent.click(numeros)
    fireEvent.click(ganhos)
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(await screen.findByText(/Salvo às/)).toBeDefined()
    const body = JSON.parse(mockApiFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')![1].body)
    expect(body).toMatchObject({ entregadorVeCombNumeros: true, entregadorVeCombFimRota: false, entregadorVeCombGanhos: true })
  })

  it('preço fora da faixa não salva', async () => {
    mockApiFetch.mockImplementation(() => ok(cfg))
    render(<AdminRotasConfig onBack={vi.fn()} />)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Preço do litro · Gasolina' }), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(await screen.findByText(/Preço do litro entre/)).toBeDefined()
    expect(mockApiFetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false)
  })
})

describe('A4 · Rota do entregador', () => {
  const view = {
    courier: { id: 'k1', name: 'Antônio Ribeiro' },
    slot: { slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30' },
    base: null,
    condos: [
      { id: 'cA', name: 'Residencial Jardins', lat: -23.5, lng: -46.6 },
      { id: 'cB', name: 'Edifício Aurora', lat: -23.6, lng: -46.7 },
      { id: 'cN', name: 'Parque das Águas', lat: -23.55, lng: -46.65 },
    ],
    saved: { condominiumIds: ['cB', 'cA'], km: 9.2, durationMin: 70, geometry: [], acceptedAt: '2026-09-15T12:00:00Z' },
    suggestion: { condominiumIds: ['cA', 'cN', 'cB'], km: 8.1, durationMin: 64, geometry: [], reason: 'NEW_CONDO', newIds: ['cN'], createdAt: '2026-09-28T10:00:00Z', deltaKm: -1.1 },
    changes: [{ runId: 'r1', date: '2026-09-26', condominiumIds: ['cA', 'cB'], km: 9.8, description: 'Trocou Edifício Aurora ↔ Residencial Jardins' }],
  }

  it('mostra a rota salva, a sugestão (novo, subiu/desceu, −1,1 km) e o motivo', async () => {
    mockApiFetch.mockImplementation(() => ok(view))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    expect(await screen.findByText('ROTA SALVA')).toBeDefined()
    expect(screen.getByText('desde 15/09')).toBeDefined()
    expect(screen.getByText('Sugestão nova')).toBeDefined()
    expect(screen.getByText('−1,1 km')).toBeDefined()
    expect(screen.getByText('novo')).toBeDefined()
    expect(screen.getByText('subiu 1')).toBeDefined()
    expect(screen.getByText('desceu 1')).toBeDefined()
    expect(screen.getByText(/entrou na rota em 28\/09/)).toBeDefined()
  })

  it('usar sugestão e manter a atual chamam a API e mostram "Rota salva"', async () => {
    mockApiFetch.mockImplementation((url: string) => ok(url.endsWith('/accept') || url.endsWith('/keep') ? { ...view, suggestion: null } : view))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Usar sugestão/ }))
    expect(await screen.findByText(/Rota salva\. Vale a partir da próxima rota para Antônio · Manhã\./)).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/couriers/k1/routes/manha/accept', { method: 'POST' })
    expect(screen.getByText('Nenhuma sugestão nova. A rota está em dia.')).toBeDefined()
  })

  it('ajustar: lista arrastável e "Salvar rota" manda a ordem', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => ok(opts?.method === 'PUT' ? { ...view, suggestion: null } : view))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajustar/ }))
    expect(screen.getByText('Arraste para mudar a ordem. O km e a hora prevista recalculam na hora.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Arrastar Parque das Águas' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Salvar rota/ }))
    await waitFor(() => expect(mockApiFetch.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(true))
    const [url, opts] = mockApiFetch.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(url).toBe('/admin/couriers/k1/routes/manha')
    expect(JSON.parse(opts.body)).toEqual({ condominiumIds: ['cA', 'cN', 'cB'] })
  })

  it('alterações do entregador: ver a ordem e adotar como rota padrão', async () => {
    mockApiFetch.mockImplementation(() => ok(view))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    expect(await screen.findByText('Trocou Edifício Aurora ↔ Residencial Jardins')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Adotar como rota padrão' }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/couriers/k1/routes/manha/adopt/r1', { method: 'POST' }))
  })

  it('erro da API aparece (ex.: manter sem rota salva)', async () => {
    mockApiFetch.mockImplementation((url: string) => (url.endsWith('/keep') ? bad(400, { error: 'Ainda não há rota salva para manter' }) : ok(view)))
    render(<CourierRouteScreen courierId="k1" slotId="manha" onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Manter a atual' }))
    expect(await screen.findByText('Ainda não há rota salva para manter')).toBeDefined()
  })
})

describe('A2 · mapa ao vivo', () => {
  const live = {
    date: '2026-10-02',
    base: null,
    routes: [
      { courierId: 'k1', courierName: 'Antônio Ribeiro', slotId: 'manha', slotLabel: 'Manhã', slotEmoji: '☀️', state: 'em_rota', startedAt: '2026-10-02T08:12:00.000Z', endedAt: null, etaEnd: '06:38', done: 7, total: 12, noPhoto: 1, reordered: true, lastPos: { lat: -23.5, lng: -46.6, at: new Date(Date.now() - 14 * 60_000).toISOString(), stale: true } },
      { courierId: 'k2', courierName: 'Joana Pires', slotId: 'manha', slotLabel: 'Manhã', slotEmoji: '☀️', state: 'pronta', startedAt: null, endedAt: null, etaEnd: null, done: 0, total: 9, noPhoto: 0, reordered: false, lastPos: null },
    ],
    stops: [
      { key: 's1', courierId: 'k1', slotId: 'manha', condominiumName: 'Jardins', clientName: 'Maria', apartment: '101', block: null, status: 'entregue', time: '05:31', failureLabel: null, proof: 'ok', noPhoto: false, noPhotoNote: null },
      { key: 's2', courierId: 'k1', slotId: 'manha', condominiumName: 'Jardins', clientName: 'Pedro', apartment: '204', block: null, status: 'nao_entregue', time: '05:47', failureLabel: 'Portaria não liberou', proof: 'sem', noPhoto: true, noPhotoNote: 'Local sem luz' },
      { key: 's3', courierId: 'k2', slotId: 'manha', condominiumName: 'Aurora', clientName: 'Ana', apartment: '12', block: null, status: 'pendente', time: null, failureLabel: null, proof: null, noPhoto: false, noPhotoNote: null },
    ],
    condos: [{ id: 'cA', name: 'Jardins', lat: -23.5, lng: -46.6, done: false }],
  }

  it('rotas com progresso, término, sem foto, ordem alterada e posição velha; abre a rota', async () => {
    mockApiFetch.mockImplementation(() => ok(live))
    const onOpenRoute = vi.fn()
    render(<LiveRoutesCard onOpenRoute={onOpenRoute} />)
    expect(await screen.findByText('1 em rota')).toBeDefined()
    expect(screen.getByTestId('map').textContent).toContain('AR (velha)')
    expect(screen.getByText(/Antônio R\. sem posição há 14 min\./)).toBeDefined()
    expect(screen.getByText(/Em rota desde 05:12 · término ~06:38/)).toBeDefined()
    expect(screen.getByText('7/12')).toBeDefined()
    expect(screen.getByText('1 sem foto')).toBeDefined()
    expect(screen.getByText('ordem alterada hoje')).toBeDefined()
    expect(screen.getByText('Não iniciada')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Rota de Joana Pires · Manhã' }))
    expect(onOpenRoute).toHaveBeenCalledWith('k2', 'manha')
  })

  it('filtros: Pendentes e Sem foto', async () => {
    mockApiFetch.mockImplementation(() => ok(live))
    render(<LiveRoutesCard onOpenRoute={vi.fn()} />)
    const chips = await screen.findByRole('radiogroup', { name: 'Filtrar paradas' })
    fireEvent.click(within(chips).getByRole('radio', { name: /Sem foto/ }))
    expect(screen.getByText('Pedro · Apto 204')).toBeDefined()
    expect(screen.getByText('Local sem luz')).toBeDefined()
    expect(screen.queryByText('Maria · Apto 101')).toBeNull()
    fireEvent.click(within(chips).getByRole('radio', { name: /Pendentes/ }))
    expect(screen.getByText('Ana · Apto 12')).toBeDefined()
  })

  it('sem rota no dia: o card não aparece; consulta de novo a cada 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockApiFetch.mockImplementation(() => ok({ ...live, routes: [], stops: [], condos: [] }))
    const { container } = render(<LiveRoutesCard onOpenRoute={vi.fn()} />)
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
    expect(container.textContent).toBe('')
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2))
    vi.useRealTimers()
  })
})
