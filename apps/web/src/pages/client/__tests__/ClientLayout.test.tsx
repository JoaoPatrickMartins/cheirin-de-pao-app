// Gating de primeiro acesso em ClientLayout.
// Fonte de verdade: GET /client/onboarding (backend). localStorage só define a retomada
// e serve de cache offline. Conclusão: POST /client/onboarding/complete.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const ob = vi.hoisted(() => ({
  hasSeen: vi.fn(() => false),
  slides: vi.fn(() => false),
  markSlides: vi.fn(),
  markSeen: vi.fn(),
}))
vi.mock('../../../lib/onboarding', () => ({
  hasSeenOnboarding: ob.hasSeen,
  slidesDone: ob.slides,
  markSlidesDone: ob.markSlides,
  markOnboardingSeen: ob.markSeen,
}))

// apiFetch: GET /client/onboarding (fonte de verdade), /client/hook-request (mount),
// POST /client/onboarding/complete (finishTour).
const api = vi.hoisted(() => {
  const self = {
    completed: false,
    defaultImpl: (path: string) => {
      if (path === '/client/onboarding') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed: self.completed }) })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    },
    fetch: vi.fn(),
  }
  return self
})
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

const auth = vi.hoisted(() => ({
  state: { user: { id: 'u1', role: 'CLIENT', name: 'Ana' }, isLoading: false },
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth.state }))
vi.mock('../../../hooks/useOneSignalRegister', () => ({ useOneSignalRegister: () => {} }))
vi.mock('../../../hooks/useOneSignalDeepLink', () => ({ useOneSignalDeepLink: () => {} }))
vi.mock('../../../contexts/NotifContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NotifProvider: ({ children }: any) => children,
}))
vi.mock('../../../components/client/ClientTabBar', () => ({ ClientTabBar: () => null }))
vi.mock('../../../components/client/OnboardingOverlay', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OnboardingOverlay: ({ onFinish }: any) => <button onClick={onFinish}>SLIDES</button>,
}))
vi.mock('../../../components/client/AppTour', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AppTour: ({ onFinish }: any) => <button onClick={onFinish}>TOUR</button>,
}))

import { ClientLayout } from '../ClientLayout'

function renderCL() {
  return render(
    <MemoryRouter initialEntries={['/client']}>
      <ClientLayout />
    </MemoryRouter>,
  )
}

describe('ClientLayout — gating de primeiro acesso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.completed = false
    api.fetch.mockImplementation(api.defaultImpl) // restaura impl (clearAllMocks não reseta impl)
    ob.hasSeen.mockReturnValue(false)
    ob.slides.mockReturnValue(false)
    auth.state = { user: { id: 'u1', role: 'CLIENT', name: 'Ana' }, isLoading: false }
  })

  it('mostra as telas (slides) quando o backend diz não concluído', async () => {
    api.completed = false
    ob.slides.mockReturnValue(false)
    renderCL()
    expect(await screen.findByText('SLIDES')).toBeTruthy()
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('retoma direto no tour quando slides_done (local)', async () => {
    api.completed = false
    ob.slides.mockReturnValue(true)
    renderCL()
    expect(await screen.findByText('TOUR')).toBeTruthy()
    expect(screen.queryByText('SLIDES')).toBeNull()
  })

  it('não mostra nada quando o backend diz concluído (e sincroniza cache local)', async () => {
    api.completed = true
    renderCL()
    await waitFor(() => expect(ob.markSeen).toHaveBeenCalledWith('u1'))
    expect(screen.queryByText('SLIDES')).toBeNull()
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('concluir as telas marca slides e segue para o tour', async () => {
    api.completed = false
    ob.slides.mockReturnValue(false)
    renderCL()
    fireEvent.click(await screen.findByText('SLIDES'))
    expect(ob.markSlides).toHaveBeenCalledWith('u1')
    expect(screen.getByText('TOUR')).toBeTruthy()
  })

  it('concluir o tour marca cache local e persiste no backend', async () => {
    api.completed = false
    ob.slides.mockReturnValue(true)
    renderCL()
    fireEvent.click(await screen.findByText('TOUR'))
    expect(ob.markSeen).toHaveBeenCalledWith('u1')
    expect(api.fetch).toHaveBeenCalledWith('/client/onboarding/complete', { method: 'POST' })
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('offline (GET falha) e nunca visto localmente → mostra a partir do cache local', async () => {
    api.fetch.mockImplementation((path: string) => {
      if (path === '/client/onboarding') return Promise.reject(new Error('offline'))
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
    ob.hasSeen.mockReturnValue(false)
    ob.slides.mockReturnValue(false)
    renderCL()
    expect(await screen.findByText('SLIDES')).toBeTruthy()
  })

  it('offline (GET falha) mas já visto localmente → não mostra', async () => {
    api.fetch.mockImplementation((path: string) => {
      if (path === '/client/onboarding') return Promise.reject(new Error('offline'))
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
    ob.hasSeen.mockReturnValue(true)
    renderCL()
    // dá tempo do efeito assíncrono resolver
    await waitFor(() => expect(api.fetch).toHaveBeenCalled())
    expect(screen.queryByText('SLIDES')).toBeNull()
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('evento cdp:replay-onboarding reabre as telas', async () => {
    api.completed = true
    renderCL()
    // Aguarda o decide() assentar (markSeen roda logo antes de setPhase('done'))
    // para não haver corrida com o replay.
    await waitFor(() => expect(ob.markSeen).toHaveBeenCalledWith('u1'))
    expect(screen.queryByText('SLIDES')).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('cdp:replay-onboarding'))
    })
    expect(await screen.findByText('SLIDES')).toBeTruthy()
  })
})
