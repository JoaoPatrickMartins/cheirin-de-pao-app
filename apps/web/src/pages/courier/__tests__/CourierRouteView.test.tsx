// E9 — aba Rota do entregador: turno, mapa na ordem do dia, próxima parada (Navegar, chegada),
// "Tudo entregue", reordenar só no dia e voltar à rota padrão.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('../../../components/courier/CourierMap', () => ({
  CourierMap: ({ stops, label }: { stops: Array<{ id: string; n: number; done?: boolean; next?: boolean; label?: string }>; label?: React.ReactNode }) => (
    <div data-testid="map">
      {stops.map((s) => (
        <span key={s.id}>{`${s.n}. ${s.label}${s.done ? ' ✓' : ''}${s.next ? ' (próxima)' : ''}`}</span>
      ))}
      <span>{label}</span>
    </div>
  ),
}))
const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { CourierRouteView, type CourierRouteViewProps } from '../CourierRouteView'
import type { SlotRoute } from '../../../lib/courierApi'

const stop = (orderId: string, slotId: string, quantity = 4) => ({
  orderId,
  apartment: orderId.slice(-3),
  block: null,
  clientName: `Cliente ${orderId}`,
  quantity,
  status: 'OUT_FOR_DELIVERY',
  sortKey: 1,
  slotId,
  slotLabel: slotId,
  marketOrderIds: [],
  marketItems: [],
  marketItemCount: 0,
})
const condo = (id: string, name: string, stops: ReturnType<typeof stop>[], lat: number | null = -23.5) => ({ condominiumId: id, condominiumName: name, address: 'Rua X, 1', lat, lng: lat === null ? null : -46.6, stops })
const route = (over: Partial<SlotRoute>): SlotRoute => ({
  slotId: 'manha',
  label: 'Manhã',
  emoji: '☀️',
  time: '06:30',
  condominiumIds: ['cA', 'cB'],
  route: { distanceKm: '9.2', durationMin: 40, geometry: [[-23.5, -46.6], [-23.6, -46.7]] },
  state: 'em_rota',
  run: { id: 'run-1', startedAt: '2026-10-02T08:12:00.000Z', endedAt: null, startMode: 'BASE' },
  reorderedToday: false,
  eta: [
    { condominiumId: 'cA', time: '06:41' },
    { condominiumId: 'cB', time: '06:58' },
  ],
  ...over,
})
const slots = [
  { slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30' },
  { slotId: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30' },
]
const base = (over: Partial<CourierRouteViewProps> = {}): CourierRouteViewProps => ({
  condos: [condo('cA', 'Residencial Jardins', [stop('o-101', 'manha'), stop('o-102', 'manha')]), condo('cB', 'Edifício Aurora', [stop('o-201', 'manha', 6)])],
  routes: [route({})],
  routeCondos: [],
  base: { endereco: 'Rua das Flores, 120', lat: -23.4, lng: -46.5 },
  slots,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
})

describe('CourierRouteView', () => {
  it('em rota: mapa na ordem do dia, próxima parada com a hora prevista e o que levar', () => {
    render(<CourierRouteView {...base()} />)
    expect(screen.getByText('1. Residencial Jardins (próxima)')).toBeDefined()
    expect(screen.getByText('2. Edifício Aurora')).toBeDefined()
    expect(screen.getByText(/~9,2 km · 2 prédios/)).toBeDefined()
    expect(screen.getByText('PRÓXIMA PARADA')).toBeDefined()
    // No cartão da próxima parada e na ordem de paradas.
    expect(screen.getAllByText('06:41')).toHaveLength(2)
    expect(screen.getByText('previsto')).toBeDefined()
    expect(screen.getByText('2 portas · 8 pães')).toBeDefined()
  })

  it('dia com dois turnos: seletor; trocar de turno troca os prédios', () => {
    const tarde = route({ slotId: 'tarde', label: 'Tarde', emoji: '🌙', state: 'pronta', run: null, condominiumIds: ['cC'], eta: [{ condominiumId: 'cC', time: '15:40' }] })
    render(<CourierRouteView {...base({ routes: [route({}), tarde], condos: [...base().condos, condo('cC', 'Parque das Águas', [stop('o-301', 'tarde')])] })} />)
    const tabs = screen.getByRole('tablist', { name: 'Turno da rota' })
    expect(within(tabs).getByRole('tab', { name: /Manhã · em rota/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(within(tabs).getByRole('tab', { name: /Tarde · pronta/ }))
    expect(screen.getByText('1. Parque das Águas')).toBeDefined()
    expect(screen.queryByText(/Residencial Jardins/)).toBeNull()
    expect(screen.getByText(/Esta é a sua rota salva\. O traçado começa na base — Rua das Flores, 120\./)).toBeDefined()
  })

  it('turno único não mostra seletor', () => {
    render(<CourierRouteView {...base()} />)
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('Navegar: 1ª vez escolhe o app (lembrando a escolha); depois abre direto', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { unmount } = render(<CourierRouteView {...base()} />)
    fireEvent.click(screen.getByRole('button', { name: /Navegar/ }))
    const sheet = screen.getByRole('dialog', { name: 'Abrir com qual app?' })
    fireEvent.click(within(sheet).getByRole('radio', { name: /Waze/ }))
    fireEvent.click(within(sheet).getByRole('button', { name: /Abrir Waze/ }))
    expect(open).toHaveBeenCalledWith('https://waze.com/ul?ll=-23.5,-46.6&navigate=yes', '_blank', 'noopener')
    unmount()
    render(<CourierRouteView {...base()} />)
    fireEvent.click(screen.getByRole('button', { name: /Navegar/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(open).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: /Abre no Waze · trocar/ })).toBeDefined()
  })

  it('chegou (a menos de 80 m): "Você chegou" e abre a lista do prédio', () => {
    const onOpenCondo = vi.fn()
    render(<CourierRouteView {...base({ me: { lat: -23.5003, lng: -46.6 }, onOpenCondo })} />)
    expect(screen.getByText('Você chegou ao Residencial Jardins')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Abrir lista do prédio/ }))
    expect(onOpenCondo).toHaveBeenCalledWith('cA', 'manha')
  })

  it('prédio resolvido vira "feito" e a próxima passa para o seguinte; tudo resolvido → Encerrar', () => {
    const onEnd = vi.fn()
    const { rerender } = render(<CourierRouteView {...base({ resolvedKeys: new Set(['o-101', 'o-102']), onEnd })} />)
    expect(screen.getByText('1. Residencial Jardins ✓')).toBeDefined()
    expect(screen.getByText('2. Edifício Aurora (próxima)')).toBeDefined()
    expect(screen.getByText('feito')).toBeDefined()
    rerender(<CourierRouteView {...base({ resolvedKeys: new Set(['o-101', 'o-102', 'o-201']), onEnd })} />)
    expect(screen.getByText('Tudo entregue!')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Encerrar rota$/ }))
    expect(onEnd).toHaveBeenCalledWith('manha')
  })

  it('sem traçado (OSRM fora): aviso e os pontos seguem na ordem; prédio sem coordenada marca "sem mapa"', () => {
    render(
      <CourierRouteView
        {...base({
          routes: [route({ route: null, condominiumIds: ['cA', 'cB', 'cX'] })],
          condos: [...base().condos, condo('cX', 'Vila Verde', [stop('o-901', 'manha')], null)],
        })}
      />,
    )
    expect(screen.getByText('Não conseguimos traçar o caminho agora. Os pontos seguem na ordem da rota.')).toBeDefined()
    expect(screen.getByText('sem mapa')).toBeDefined()
  })

  it('reordenar só com a permissão do admin; salvar manda a ordem do dia e "voltar" desfaz', async () => {
    const onReordered = vi.fn()
    const { rerender } = render(<CourierRouteView {...base()} />)
    expect(screen.queryByRole('button', { name: /Reordenar/ })).toBeNull()
    rerender(<CourierRouteView {...base({ canReorder: true, onReordered })} />)
    fireEvent.click(screen.getByRole('button', { name: /Reordenar/ }))
    expect(screen.getByText(/Essa ordem vale só para hoje\./)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Arrastar Residencial Jardins' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Salvar ordem de hoje/ }))
    await waitFor(() => expect(onReordered).toHaveBeenCalledTimes(1))
    const [url, opts] = mockApiFetch.mock.calls[0]
    expect(url).toBe('/courier/runs/order')
    expect(JSON.parse(opts.body)).toEqual({ slotId: 'manha', condominiumIds: ['cA', 'cB'] })

    fireEvent.click(screen.getByRole('button', { name: /Reordenar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Voltar à rota padrão/ }))
    await waitFor(() => expect(onReordered).toHaveBeenCalledTimes(2))
    expect(mockApiFetch.mock.calls[1]).toEqual(['/courier/runs/order?slotId=manha', { method: 'DELETE' }])
  })

  it('erro ao salvar a ordem (ex.: permissão retirada) fica na tela', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false, status: 403, json: () => Promise.resolve({ error: 'A operação não liberou reordenar a sua rota' }) })
    render(<CourierRouteView {...base({ canReorder: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /Reordenar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar ordem de hoje/ }))
    expect(await screen.findByText('A operação não liberou reordenar a sua rota')).toBeDefined()
  })
})
