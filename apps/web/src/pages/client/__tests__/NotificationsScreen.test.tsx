// NotificationsScreen page tests
// Requirements: ACOMP-04 (cards por tipo + CTAs), ACOMP-05 (badge sync via NotifContext)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../contexts/NotifContext', () => ({
  useNotif: () => ({ unreadCount: 0, refresh: mockRefresh }),
  NotifContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => vi.fn() }
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

function mockApiForNotifs(notifs: ReturnType<typeof makeNotif>[]) {
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

  it('CTA_CONFIG inclui OUT_FOR_DELIVERY com label "Acompanhar"', async () => {
    mockApiForNotifs([makeNotif('OUT_FOR_DELIVERY')])
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Título OUT_FOR_DELIVERY')).toBeDefined()
    })
    expect(screen.getByText('Acompanhar')).toBeDefined()
  })

  it('refresh() é chamado após PATCH mark-all-read', async () => {
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>)
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })
})
