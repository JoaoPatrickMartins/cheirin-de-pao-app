// Gating de primeiro acesso em ClientLayout (slides → tour → done + re-disparo).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const ob = vi.hoisted(() => ({
  hasSeen: vi.fn(),
  slides: vi.fn(),
  markSlides: vi.fn(),
  markSeen: vi.fn(),
}))
vi.mock('../../../lib/onboarding', () => ({
  hasSeenOnboarding: ob.hasSeen,
  slidesDone: ob.slides,
  markSlidesDone: ob.markSlides,
  markOnboardingSeen: ob.markSeen,
}))

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
    auth.state = { user: { id: 'u1', role: 'CLIENT', name: 'Ana' }, isLoading: false }
  })

  it('mostra as telas (slides) quando nada foi visto', () => {
    ob.hasSeen.mockReturnValue(false)
    ob.slides.mockReturnValue(false)
    renderCL()
    expect(screen.getByText('SLIDES')).toBeTruthy()
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('retoma direto no tour quando slides_done', () => {
    ob.hasSeen.mockReturnValue(false)
    ob.slides.mockReturnValue(true)
    renderCL()
    expect(screen.getByText('TOUR')).toBeTruthy()
    expect(screen.queryByText('SLIDES')).toBeNull()
  })

  it('não mostra nada quando já visto', () => {
    ob.hasSeen.mockReturnValue(true)
    renderCL()
    expect(screen.queryByText('SLIDES')).toBeNull()
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('concluir as telas marca slides e segue para o tour', () => {
    ob.hasSeen.mockReturnValue(false)
    ob.slides.mockReturnValue(false)
    renderCL()
    fireEvent.click(screen.getByText('SLIDES'))
    expect(ob.markSlides).toHaveBeenCalledWith('u1')
    expect(screen.getByText('TOUR')).toBeTruthy()
  })

  it('concluir o tour marca o primeiro acesso como visto', () => {
    ob.hasSeen.mockReturnValue(false)
    ob.slides.mockReturnValue(true)
    renderCL()
    fireEvent.click(screen.getByText('TOUR'))
    expect(ob.markSeen).toHaveBeenCalledWith('u1')
    expect(screen.queryByText('TOUR')).toBeNull()
  })

  it('evento cdp:replay-onboarding reabre as telas', () => {
    ob.hasSeen.mockReturnValue(true)
    renderCL()
    expect(screen.queryByText('SLIDES')).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('cdp:replay-onboarding'))
    })
    expect(screen.getByText('SLIDES')).toBeTruthy()
  })
})
