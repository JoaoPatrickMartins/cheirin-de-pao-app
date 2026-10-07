// NotificationsScreen page tests
// Requirements: ACOMP-04 (cards por tipo + CTAs), ACOMP-05 (badge sync via NotifContext)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())
const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../contexts/NotifContext', () => ({
  useNotif: () => ({ unreadCount: 0, refresh: mockRefresh }),
  NotifContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { NotificationsScreen } from '../NotificationsScreen'

function makeNotif(type: string) {
  return {
    id: `notif-${type}`,
    type,
    title: `Título ${type}`,
    body: `Corpo ${type}`,
    isRead: false,
    createdAt: '2026-06-19T10:00:00.000Z',
  }
}

function mockApiForNotifs(notifs: Array<ReturnType<typeof makeNotif> & { actionRoute?: string }>) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === '/notifications/me') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(notifs) })
    }
    // PATCH /notifications/read-all
    return Promise.resolve({ ok: true })
  })
}

describe('NotificationsScreen [ACOMP-04, ACOMP-05]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiForNotifs([])
  })

  it('renderiza AppBar "Notificações"', async () => {
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Notificações')).toBeDefined()
    })
  })

  it('renderiza empty state "Tudo tranquilo por aqui" quando lista vazia', async () => {
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Tudo tranquilo por aqui')).toBeDefined()
    })
  })

  it('CTA_CONFIG inclui DELIVERY_EVE com label "Ver pedido"', async () => {
    mockApiForNotifs([makeNotif('DELIVERY_EVE')])
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Título DELIVERY_EVE')).toBeDefined()
    })
    expect(screen.getByText('Ver pedido')).toBeDefined()
  })

  // "Saiu para entrega" (H-1 do app do entregador). O mapa antigo usava 'OUT_FOR_DELIVERY', que
  // nunca existiu no enum NotificationType — o botão nunca aparecia.
  it('CTA_CONFIG inclui DELIVERY_OUT com label "Acompanhar"', async () => {
    mockApiForNotifs([makeNotif('DELIVERY_OUT')])
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Título DELIVERY_OUT')).toBeDefined()
    })
    expect(screen.getByText('Acompanhar')).toBeDefined()
  })

  it('recado do entregador (COURIER_MESSAGE) aparece sem botão', async () => {
    mockApiForNotifs([makeNotif('COURIER_MESSAGE')])
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Título COURIER_MESSAGE')).toBeDefined()
    })
    expect(screen.queryByText('Acompanhar')).toBeNull()
    expect(screen.queryByText('Ver pedido')).toBeNull()
  })

  it('refresh() é chamado após PATCH mark-all-read', async () => {
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })
  // Indique e Ganhe (C6) — o botão in-app vem do CTA_CONFIG, por tipo.
  it.each([
    ['REFERRAL_SIGNUP', 'Ver indicações'],
    ['REFERRAL_REWARD', 'Ver saldo'],
    ['REFERRAL_WELCOME', 'Ver saldo'],
    ['REFERRAL_INVITE', 'Indicar agora'],
  ])('%s mostra o botão "%s"', async (type, label) => {
    mockApiForNotifs([makeNotif(type)])
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: label })).toBeDefined()
    })
  })

  it('visual do handoff (D-17): ícone em círculo, borda dourada no novo, texto espresso no botão dourado', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/notifications/me') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([makeNotif('REFERRAL_REWARD')]) })
      }
      return new Promise(() => {}) // read-all pendente: o item continua "novo"
    })
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    const button = await screen.findByRole('button', { name: 'Ver saldo' })
    expect(button.style.color).toBe('var(--color-espresso)')
    const card = screen.getByLabelText('Título REFERRAL_REWARD: Corpo REFERRAL_REWARD')
    expect(card.style.border).toContain('var(--color-gold)')
    const iconCircle = card.firstElementChild as HTMLElement
    expect(iconCircle.style.borderRadius).toBe('999px')
  })

  // C3 do plano do entregador: entrega com foto visível ao cliente → "Ver foto" abre o comprovante.
  it('DELIVERY_DONE com comprovante: "Ver foto" leva à foto; sem comprovante segue "Ver pedido"', async () => {
    mockApiForNotifs([
      { ...makeNotif('DELIVERY_DONE'), id: 'n1', actionRoute: '/client/pedidos?comprovante=o1' },
      { ...makeNotif('DELIVERY_DONE'), id: 'n2', title: 'Outra entrega', actionRoute: '/client/pedidos' },
    ])
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    const photo = await screen.findByRole('button', { name: 'Ver foto' })
    expect(screen.getByRole('button', { name: 'Ver pedido' })).toBeDefined()
    fireEvent.click(photo)
    expect(mockNavigate).toHaveBeenCalledWith('/client/pedidos?comprovante=o1')
  })
})
