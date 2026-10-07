// Operação dos entregadores no admin (Onda 8): problema reportado no A1 (H-2), problemas e
// ocorrências, gancho na rota (A7), acesso do condomínio (A6) e motivos padronizados (A10).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('browser-image-compression', () => ({ default: vi.fn(async (f: File) => f) }))
vi.mock('../../../../lib/xlsx', () => ({ downloadXlsx: vi.fn() }))
vi.mock('../../../../lib/viacep', () => ({ lookupCep: vi.fn(async () => null) }))

import { OrderIssues } from '../../../../components/admin/OrderIssues'
import { HookRouteSheet } from '../../../../components/admin/HookRouteSheet'
import { CourierReports } from '../CourierReports'
import { CondoForm } from '../CondoForm'
import { RelEntregas } from '../RelEntregas'

const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(b) })
beforeEach(() => vi.clearAllMocks())

const issue = { id: 'r1', type: 'CONFIRMEI_POR_ENGANO', label: 'Confirmei por engano', text: 'O saquinho ainda está comigo', createdAt: '2026-10-02T08:40:00.000Z', courierName: 'Antônio Ribeiro', status: 'OPEN', resolution: null }

describe('A1 · problema reportado (H-2)', () => {
  it('"Marcar não entregue" confirma, explica que não avisa o cliente e chama a correção', async () => {
    mockApiFetch.mockImplementation(() => ok({ id: 'o1' }))
    const onCorrected = vi.fn()
    render(<OrderIssues issues={[issue]} correction={null} orderId="o1" canCorrect onCorrected={onCorrected} />)
    expect(screen.getByText('Confirmei por engano · 05:40')).toBeDefined()
    expect(screen.getByText(/“O saquinho ainda está comigo” — Antônio R\./)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar não entregue' }))
    expect(screen.getByText(/O cliente/).textContent).toContain('não é avisado')
    fireEvent.change(screen.getByLabelText('Nota da correção (opcional)'), { target: { value: 'voltou comigo' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar: não entregue/ }))
    await waitFor(() => expect(onCorrected).toHaveBeenCalled())
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/orders/o1/correct-not-delivered', { method: 'POST', body: JSON.stringify({ note: 'voltou comigo' }) })
  })

  it('"Manter entregue" resolve o reporte; corrigido mostra quem e quando', async () => {
    mockApiFetch.mockImplementation(() => ok({ id: 'r1', status: 'RESOLVED', resolution: 'KEPT' }))
    const { unmount } = render(<OrderIssues issues={[issue]} correction={null} orderId="o1" canCorrect onCorrected={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Manter entregue' }))
    expect(await screen.findByText('mantido entregue')).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/courier-reports/r1/resolve', { method: 'POST' })
    unmount()
    render(<OrderIssues issues={[{ ...issue, status: 'RESOLVED', resolution: 'CORRECTED' }]} correction={{ at: '2026-10-02T12:00:00.000Z', byName: 'Admin', note: 'voltou comigo' }} orderId="o1" canCorrect={false} onCorrected={vi.fn()} />)
    expect(screen.getByText('marcado não entregue')).toBeDefined()
    expect(screen.getByText(/Corrigido para não entregue em 02\/10, 09:00 por Admin · “voltou comigo”/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Marcar não entregue' })).toBeNull()
  })
})

describe('Problemas e ocorrências', () => {
  const list = [
    { id: 'r1', kind: 'STOP_ISSUE', type: 'CONFIRMEI_POR_ENGANO', label: 'Confirmei por engano', text: 'Ficou comigo', photoUrl: null, status: 'OPEN', resolution: null, createdAt: '2026-10-02T08:40:00.000Z', resolvedAt: null, courier: { id: 'k1', name: 'Antônio Ribeiro' }, stop: { orderId: 'o1', marketOrderId: null, clientName: 'Pedro Alves', place: 'Bloco 1 · Apto 204 · Residencial Jardins', status: 'DELIVERED' } },
    { id: 'r2', kind: 'INCIDENT', type: 'VEICULO', label: 'Problema no veículo', text: 'Pneu', photoUrl: 'https://signed/x.jpg', status: 'OPEN', resolution: null, createdAt: '2026-10-02T08:52:00.000Z', resolvedAt: null, courier: { id: 'k2', name: 'Joana Pires' }, stop: null },
  ]

  it('lista com a parada e a foto; corrige ou resolve', async () => {
    mockApiFetch.mockImplementation((url: string) => (url.startsWith('/admin/courier-reports?') || url === '/admin/courier-reports' ? ok(list) : ok({})))
    render(<CourierReports onBack={vi.fn()} />)
    const prob = await screen.findByRole('group', { name: 'Confirmei por engano — Antônio Ribeiro' })
    expect(within(prob).getByText('Pedro Alves')).toBeDefined()
    fireEvent.click(within(prob).getByRole('button', { name: 'Marcar não entregue' }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/orders/o1/correct-not-delivered', { method: 'POST', body: JSON.stringify({ note: null }) }))
    const inc = screen.getByRole('group', { name: 'Problema no veículo — Joana Pires' })
    fireEvent.click(within(inc).getByRole('button', { name: 'Ver a foto da ocorrência' }))
    expect(screen.getByRole('dialog', { name: 'Foto da ocorrência' })).toBeDefined()
    fireEvent.click(within(inc).getByRole('button', { name: 'Marcar como resolvida' }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/courier-reports/r2/resolve', { method: 'POST' }))
  })

  it('foto da ocorrência com mais de 90 dias: selo "foto expirada", sem miniatura', async () => {
    const old = { ...list[1], id: 'r3', photoUrl: null, photoExpired: true, createdAt: '2026-06-01T08:52:00.000Z' }
    mockApiFetch.mockImplementation((url: string) => (url.startsWith('/admin/courier-reports') ? ok([old]) : ok({})))
    render(<CourierReports onBack={vi.fn()} />)
    const inc = await screen.findByRole('group', { name: 'Problema no veículo — Joana Pires' })
    expect(within(inc).getByText('foto expirada (90 dias)')).toBeDefined()
    expect(within(inc).queryByRole('button', { name: 'Ver a foto da ocorrência' })).toBeNull()
  })
})

describe('A7 · enviar o gancho na rota', () => {
  const antonio = { id: 'k1', name: 'Antônio Ribeiro', photoUrl: null }
  const bruna = { id: 'k2', name: 'Bruna Lopes', photoUrl: null }
  const dora = { id: 'k4', name: 'Dora Reis', photoUrl: null }
  const opt = (o: Record<string, unknown>) => ({ slotId: 'manha', slotLabel: 'Manhã', slotEmoji: '☀️', slotTime: '06:30', withBread: true, courierLocked: false, courier: null, unavailableCourierIds: [], ...o })
  const respond = (options: unknown[]) =>
    mockApiFetch.mockImplementation((url: string) => (url.endsWith('/route-options') ? ok({ options, couriers: [antonio, bruna, dora] }) : ok({ ok: true })))

  it('pão já despachado: entregador fixo da parada, sem escolha, e envio sem courierId', async () => {
    respond([opt({ date: '2026-10-03', courierLocked: true, courier: antonio })])
    const onSent = vi.fn()
    render(<HookRouteSheet hookId="h1" clientName="Hugo Martins" place="Vila Verde · A · 3" onClose={vi.fn()} onSent={onSent} />)
    expect(await screen.findByText('Antônio R.')).toBeDefined()
    expect(screen.getByText('Entregador da rota do cliente')).toBeDefined()
    expect(screen.getByText('🥖 Vai junto com o pão de Hugo')).toBeDefined()
    expect(screen.queryByRole('radiogroup', { name: 'Quem leva' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Enviar na rota de 03\/10/ }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/hook-requests/h1/route', { method: 'POST', body: JSON.stringify({ date: '2026-10-03', slotId: 'manha' }) })
  })

  it('só o gancho: 7 dias, sugerido primeiro, indisponível fora da lista e envio com quem leva', async () => {
    respond([
      opt({ date: '2026-10-03', withBread: true, courier: antonio }),
      opt({ date: '2026-10-07', withBread: false, courier: bruna, unavailableCourierIds: ['k4'] }),
    ])
    const onSent = vi.fn()
    render(<HookRouteSheet hookId="h1" clientName="Hugo Martins" place="Vila Verde" onClose={vi.fn()} onSent={onSent} />)
    // Com pão ainda sem divisão: escolhe-se quem leva, com o aviso de que o pão tem prioridade.
    expect(await screen.findByText(/o gancho vai junto com o pão/)).toBeDefined()
    fireEvent.click(screen.getByRole('radio', { name: 'Qua 07/10' }))
    expect(screen.getByText('🪝 Só o gancho: parada própria na rota')).toBeDefined()
    const who = screen.getByRole('radiogroup', { name: 'Quem leva' })
    const names = within(who).getAllByRole('radio').map((r) => r.textContent)
    expect(names).toEqual(['BLBruna L.Sugerido', 'ARAntônio R.']) // iniciais do avatar + nome; Dora está de folga
    expect(within(who).getByRole('radio', { name: /Bruna/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(who).getByRole('radio', { name: /Antônio/ }))
    fireEvent.click(screen.getByRole('button', { name: /Enviar só o gancho em 07\/10/ }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/hook-requests/h1/route', { method: 'POST', body: JSON.stringify({ date: '2026-10-07', slotId: 'manha', courierId: 'k1' }) })
  })

  it('sem sugestão: o botão pede quem leva antes de enviar', async () => {
    respond([opt({ date: '2026-10-07', withBread: false })])
    render(<HookRouteSheet hookId="h1" clientName="Hugo Martins" place="Vila Verde" onClose={vi.fn()} onSent={vi.fn()} />)
    const btn = (await screen.findByRole('button', { name: 'Escolha quem leva' })) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /Bruna/ }))
    expect((screen.getByRole('button', { name: /Enviar só o gancho em 07\/10/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('sem turno nos próximos dias: avisa', async () => {
    mockApiFetch.mockImplementation(() => ok({ options: [], couriers: [] }))
    render(<HookRouteSheet hookId="h1" clientName="Hugo Martins" place="Vila Verde" onClose={vi.fn()} onSent={vi.fn()} />)
    expect(await screen.findByText(/O condomínio do cliente não tem turno de entrega nos próximos 7 dias/)).toBeDefined()
  })
})

describe('A6 · aba Acesso do condomínio', () => {
  const condo = {
    name: 'Residencial Jardins',
    address: { street: 'Rua A', number: '1', city: 'São Paulo', state: 'SP', zip: '01310100' },
    type: 'SINGLE_ENTRANCE',
    lat: -23.5,
    lng: -46.6,
    approxLocation: false,
    courierAccess: { portaria: '24 h', temPorteiro: true, portao: 'Interfone 0', parar: null, obs: null, fotoUrl: null },
  }
  const suggestion = { id: 's1', field: 'PORTAO', fieldLabel: 'Portão', text: 'O interfone agora é 9', createdAt: '2026-09-29T09:00:00.000Z', courierName: 'Antônio Ribeiro', courierPhotoUrl: null }

  it('aplica a sugestão (troca o campo) e salva o acesso junto do condomínio', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/admin/condominiums/c1' && !opts?.method) return ok(condo)
      if (url.endsWith('/access-suggestions')) return ok([suggestion])
      if (url.endsWith('/apply')) return ok({ courierAccess: { ...condo.courierAccess, portao: 'O interfone agora é 9' }, suggestions: [] })
      return ok({})
    })
    const onSaved = vi.fn()
    render(<CondoForm id="c1" onBack={vi.fn()} onSaved={onSaved} />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Acesso' }))
    expect(await screen.findByText('“O interfone agora é 9”')).toBeDefined()
    expect(screen.getByDisplayValue('Interfone 0')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }))
    expect(await screen.findByDisplayValue('O interfone agora é 9')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Onde parar o veículo'), { target: { value: 'Vaga de visitante' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar condomínio/ }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const patch = mockApiFetch.mock.calls.find(([u, o]) => u === '/admin/condominiums/c1' && o?.method === 'PATCH')!
    const body = JSON.parse(patch[1].body)
    expect(body.courierAccess).toEqual({ portaria: '24 h', temPorteiro: true, portao: 'O interfone agora é 9', parar: 'Vaga de visitante', obs: null, fotoUrl: null })
    // coordenadas carregadas não voltam como manuais (aviso de localização aproximada preservado)
    expect(body).not.toHaveProperty('lat')
  })
})

describe('A10 · Entregas & falhas', () => {
  it('motivos padronizados com % e as entregas sem foto', async () => {
    mockApiFetch.mockImplementation(() =>
      ok({
        window: { from: '', to: '', label: 'este mês', isPartial: true },
        counts: { total: 100, delivered: 90, notDelivered: 8, cancelled: 2, inProgress: 0 },
        deliveryRate: 0.918,
        failureReasons: [{ reason: 'Cliente ausente', count: 6 }],
        cancelReasons: [],
        failureCodes: [
          { code: 'CLIENTE_AUSENTE', label: 'Cliente ausente', count: 6 },
          { code: 'PORTARIA_NAO_LIBEROU', label: 'Portaria não liberou', count: 2 },
        ],
        noPhoto: { count: 6, byReason: [{ label: 'Local sem luz', count: 4 }, { label: 'Outro', count: 2 }] },
      }),
    )
    render(<RelEntregas onBack={vi.fn()} />)
    expect(await screen.findByRole('group', { name: 'Cliente ausente: 6' })).toBeDefined()
    expect(screen.getByText('75%')).toBeDefined()
    expect(screen.getByText('6 entregas sem foto')).toBeDefined()
    expect(screen.getByText(/4 “local sem luz”/)).toBeDefined()
  })
})
