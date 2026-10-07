// Pessoas do entregador (Onda 6): perfil (E14), crachá digital (E15), meus números (E17),
// minha escala (E18) e o estado "sem entregas hoje / folga" da tela principal.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../components/PushNotificationToggle', () => ({ PushNotificationToggle: () => null }))

import { CourierProfile } from '../CourierProfile'
import { CourierNumbers } from '../CourierNumbers'
import { CourierSchedule } from '../CourierSchedule'
import { CourierNoDeliveries } from '../../../components/courier/CourierWeek'
import { emptyStats, meBody, scheduleBody, scheduleOffToday, statsBody } from './peopleFixtures'

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockApiFetch.mockImplementation((url: string) => {
    if (url.startsWith('/courier/stats')) return json(statsBody(url.endsWith('days=7') ? 7 : 30))
    if (url === '/courier/schedule') return json(scheduleBody())
    return json({})
  })
})

describe('E14 · Perfil', () => {
  const props = () => ({ fallbackName: 'Antônio', onClose: vi.fn(), onOpenBadge: vi.fn(), onOpenEarnings: vi.fn(), onOpenOps: vi.fn(), onOpenNumbers: vi.fn(), onOpenSchedule: vi.fn(), onLogout: vi.fn() })

  it('mostra dados, atalhos do trabalho e o veículo (só leitura)', () => {
    render(<CourierProfile me={meBody({ showFuel: true })} {...props()} />)
    const page = screen.getByRole('dialog', { name: 'Perfil' })
    expect(within(page).getByText('Antônio Ribeiro')).toBeDefined()
    expect(within(page).getByText('(11) 99888-7766')).toBeDefined()
    expect(within(page).getByText('312 entregas em 30 dias')).toBeDefined()
    expect(within(page).getByText('Seg a sáb · próxima folga 12/10')).toBeDefined()
    expect(within(page).getByText('Moto · CG 160')).toBeDefined()
    expect(within(page).getByText('Placa ABC1D23')).toBeDefined()
    expect(within(page).getByText('Gasolina · 38 km/l')).toBeDefined()
    expect(within(page).getByText('Usado no combustível estimado')).toBeDefined()
    expect(within(page).getByText(/Quer mudar algum dado\? Fale com a operação/)).toBeDefined()
  })

  it('sem nenhuma tela com combustível (A5): o consumo aparece sem "Usado no combustível estimado"', () => {
    render(<CourierProfile me={meBody({ showFuel: false })} {...props()} />)
    expect(screen.getByText('Gasolina · 38 km/l')).toBeDefined()
    expect(screen.queryByText('Usado no combustível estimado')).toBeNull()
  })

  it('atalhos abrem crachá, ganhos, números e escala; Sair pede confirmação fora daqui', () => {
    const p = props()
    render(<CourierProfile me={meBody()} {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Crachá digital/ }))
    fireEvent.click(screen.getByRole('button', { name: /Meus ganhos/ }))
    fireEvent.click(screen.getByRole('button', { name: /Meus números/ }))
    fireEvent.click(screen.getByRole('button', { name: /Minha escala/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(p.onOpenBadge).toHaveBeenCalled()
    expect(p.onOpenEarnings).toHaveBeenCalled()
    expect(p.onOpenNumbers).toHaveBeenCalled()
    expect(p.onOpenSchedule).toHaveBeenCalled()
    expect(p.onLogout).toHaveBeenCalled()
  })

  it('app de mapas: escolhe e salva a preferência', () => {
    render(<CourierProfile me={meBody()} {...props()} />)
    expect(screen.getByText('Perguntar')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /App de mapas/ }))
    const sheet = screen.getByRole('dialog', { name: 'Abrir com qual app?' })
    expect(within(sheet).queryByRole('switch')).toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: /Usar este app/ }))
    expect(screen.queryByRole('dialog', { name: 'Abrir com qual app?' })).toBeNull()
    expect(screen.queryByText('Perguntar')).toBeNull()
  })

  it('sem veículo cadastrado e sem dados do servidor: usa o nome do login', () => {
    render(<CourierProfile me={null} {...props()} />)
    expect(screen.getByText('Antônio')).toBeDefined()
    expect(screen.getByText('Não cadastrado')).toBeDefined()
  })
})

// E15 · Crachá digital: ver CourierBadge.test.tsx (v3, Onda 11).

describe('E17 · Meus números', () => {
  it('30 dias: taxa de sucesso, KPIs, gráfico e últimos dias', async () => {
    render(<CourierNumbers firstName="Antônio" onClose={vi.fn()} />)
    expect(await screen.findByText('97%')).toBeDefined()
    expect(screen.getByText('Mandou bem! Quase todo mundo acordou com pão na porta.')).toBeDefined()
    expect(screen.getByText('286')).toBeDefined()
    expect(screen.getByText('1.144')).toBeDefined()
    expect(screen.getByText('52 min')).toBeDefined()
    // km e combustível estimados são só do admin (A9)
    expect(screen.queryByText('Km estimado')).toBeNull()
    expect(screen.queryByText('Combustível estimado')).toBeNull()
    expect(screen.getByRole('img', { name: 'Entregas por dia nos últimos 30 dias' })).toBeDefined()
    expect(screen.getByText('Hoje · 02/10')).toBeDefined()
    expect(screen.getByText('Qui · 01/10')).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/courier/stats?days=30', {})
  })

  it('com o switch "Meus números" do A5 ligado: km e combustível estimados', async () => {
    mockApiFetch.mockImplementation((url: string) => (url.startsWith('/courier/stats') ? json(statsBody(30, { fuelVisible: true, km: 412.5, fuel: 66.12 })) : json({})))
    render(<CourierNumbers firstName="Antônio" onClose={vi.fn()} />)
    expect(await screen.findByText('~412,5 km')).toBeDefined()
    expect(screen.getByText('≈ R$ 66,12')).toBeDefined()
    expect(screen.getByText('Combustível estimado')).toBeDefined()
  })

  it('trocar para 7 dias busca de novo', async () => {
    render(<CourierNumbers firstName="Antônio" onClose={vi.fn()} />)
    await screen.findByText('97%')
    fireEvent.click(screen.getByRole('radio', { name: '7 dias' }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/courier/stats?days=7', {}))
    expect(await screen.findByRole('img', { name: 'Entregas por dia nos últimos 7 dias' })).toBeDefined()
    expect(screen.getByRole('radio', { name: '7 dias' }).getAttribute('aria-checked')).toBe('true')
  })

  it('sem histórico: boas-vindas com o próximo turno e KPIs vazios', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith('/courier/stats')) return json(emptyStats())
      if (url === '/courier/schedule') return json(scheduleBody())
      return json({})
    })
    render(<CourierNumbers firstName="Antônio" onClose={vi.fn()} />)
    expect(await screen.findByText('BEM-VINDO, ANTÔNIO')).toBeDefined()
    expect(screen.getByText('Seus números começam na primeira rota')).toBeDefined()
    expect(await screen.findByText(/Sábado, 03\/10 · ☀️ Manhã · 06:30/)).toBeDefined()
    expect(screen.getByText('Cada rota encerrada entra aqui. Sem ranking: são só os seus números.')).toBeDefined()
  })
})

describe('E18 · Minha escala', () => {
  it('semana com turnos e folga, legenda e próximas folgas', async () => {
    render(<CourierSchedule onClose={vi.fn()} />)
    expect(await screen.findByText('Esta semana · 28/09–04/10')).toBeDefined()
    expect(screen.getByLabelText('Ter 29: Manhã e Tarde')).toBeDefined()
    expect(screen.getByLabelText('Sex 02 (hoje): Manhã')).toBeDefined()
    expect(screen.getByLabelText('Dom 04: folga')).toBeDefined()
    expect(screen.getByText('🌇 Tarde · 16:00')).toBeDefined()
    expect(screen.getByText('12/10 a 13/10')).toBeDefined()
    expect(screen.getByText('Consulta médica')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Fale com a operação' })).toBeDefined()
    expect(screen.queryByText(/Hoje é sua folga/)).toBeNull()
  })

  it('hoje é folga: aviso com a próxima rota', async () => {
    mockApiFetch.mockImplementation((url: string) => (url === '/courier/schedule' ? json(scheduleOffToday()) : json({})))
    render(<CourierSchedule onClose={vi.fn()} />)
    expect(await screen.findByText('Hoje é sua folga 🌿')).toBeDefined()
    expect(screen.getByText(/Sua próxima rota é amanhã, ☀️ Manhã · 06:30\./)).toBeDefined()
  })

  it('sem folgas marcadas', async () => {
    mockApiFetch.mockImplementation((url: string) => (url === '/courier/schedule' ? json(scheduleBody({ timeOffs: [] })) : json({})))
    render(<CourierSchedule onClose={vi.fn()} />)
    expect(await screen.findByText('Nenhuma folga marcada além dos dias fora da escala.')).toBeDefined()
  })
})

describe('E1 · sem entregas hoje', () => {
  it('folga: 🌿, próximo turno, semana e atalho para a escala', () => {
    const onOpen = vi.fn()
    render(<CourierNoDeliveries schedule={scheduleOffToday()} onOpenSchedule={onOpen} />)
    expect(screen.getByText('Hoje é sua folga')).toBeDefined()
    expect(screen.getByText('Descanse. Sua próxima rota é amanhã.')).toBeDefined()
    expect(screen.getByText('PRÓXIMO TURNO')).toBeDefined()
    expect(screen.getByText('Amanhã · ☀️ Manhã · 06:30')).toBeDefined()
    expect(screen.getByText('ESTA SEMANA')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Ver minha escala/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('dia de trabalho sem entregas: "Nenhuma entrega hoje", sem a semana', () => {
    render(<CourierNoDeliveries schedule={scheduleBody()} onOpenSchedule={vi.fn()} />)
    expect(screen.getByText('Nenhuma entrega hoje')).toBeDefined()
    expect(screen.getByText('Quando a operação atribuir entregas para você, elas aparecem aqui.')).toBeDefined()
    expect(screen.queryByText('ESTA SEMANA')).toBeNull()
  })

  it('sem a escala (sem sinal): só o vazio', () => {
    render(<CourierNoDeliveries schedule={null} onOpenSchedule={vi.fn()} />)
    expect(screen.getByText('Nenhuma entrega hoje')).toBeDefined()
    expect(screen.queryByText('PRÓXIMO TURNO')).toBeNull()
  })
})
