// C5 — fila única de overlays da abertura: tutorial → gancho → comemoração → pop-up de banner.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

const api = vi.hoisted(() => ({
  onboardingDone: true,
  needsConsent: false,
  summary: null as unknown,
  fetch: vi.fn(),
}))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))
vi.mock('../../../lib/onboarding', () => ({
  hasSeenOnboarding: () => true,
  slidesDone: () => true,
  markSlidesDone: vi.fn(),
  markOnboardingSeen: vi.fn(),
}))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'CLIENT', name: 'Ana' }, isLoading: false }),
}))
vi.mock('../../../hooks/useOneSignalRegister', () => ({ useOneSignalRegister: () => {} }))
vi.mock('../../../hooks/useOneSignalDeepLink', () => ({ useOneSignalDeepLink: () => {} }))
vi.mock('../../../contexts/NotifContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NotifProvider: ({ children }: any) => children,
}))
vi.mock('../../../contexts/CartContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CartProvider: ({ children }: any) => children,
}))
vi.mock('../../../contexts/BannerContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BannerProvider: ({ children }: any) => children,
}))
vi.mock('../../../components/client/ClientTabBar', () => ({ ClientTabBar: () => null }))
vi.mock('../../../components/client/FloatingCart', () => ({ FloatingCart: () => null }))
vi.mock('../../../components/client/OnboardingOverlay', () => ({ OnboardingOverlay: () => <div>SLIDES</div> }))
vi.mock('../../../components/client/AppTour', () => ({ AppTour: () => <div>TOUR</div> }))
vi.mock('../../../components/client/GanchoConsentModal', () => ({
  GanchoConsentModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>GANCHO</div> : null),
}))
vi.mock('../../../components/client/BannerPopupHost', () => ({
  BannerPopupHost: ({ enabled }: { enabled: boolean }) => (enabled ? <div>BANNER</div> : null),
}))

import { ClientLayout } from '../ClientLayout'
import { __resetReferralSummaryCache } from '../../../hooks/useReferralSummary'

const referrerCelebration = {
  variant: 'referrer',
  breads: 5,
  names: ['Maria'],
  referrerName: null,
  goal: null,
  seen: { referralIds: ['r1'], goalThresholds: [], welcome: false },
}

function summaryWith(celebration: unknown) {
  return {
    active: true, hasReferrals: true, isNew: false, rewardBreads: 5, campaign: null,
    homeCard: { visible: false }, bonusThisMonth: 0, celebration,
  }
}

function renderCL() {
  return render(
    <MemoryRouter initialEntries={['/client/home']}>
      <Routes>
        <Route path="/client" element={<ClientLayout />}>
          <Route path="home" element={<div>HOME</div>} />
          <Route path="perfil/indique" element={<div>TELA INDIQUE</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetReferralSummaryCache()
  api.onboardingDone = true
  api.needsConsent = false
  api.summary = summaryWith(referrerCelebration)
  api.fetch.mockImplementation((path: string) => {
    const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    if (path === '/client/onboarding') return ok({ completed: api.onboardingDone })
    if (path === '/client/hook-request') return ok({ needsConsent: api.needsConsent })
    if (path === '/referrals/summary') return ok(api.summary)
    return ok({})
  })
})

describe('ClientLayout — fila de overlays com a comemoração (C5)', () => {
  it('comemoração pendente aparece e o banner espera', async () => {
    renderCL()
    expect(await screen.findByRole('dialog', { name: 'Você ganhou 5 pãezins!' })).toBeInTheDocument()
    expect(screen.getByText('Maria recebeu o primeiro pedido. Obrigado por espalhar o cheirinho de pão.')).toBeInTheDocument()
    expect(screen.queryByText('BANNER')).toBeNull()
  })

  it('gancho pendente vem ANTES: nada de comemoração por cima', async () => {
    api.needsConsent = true
    renderCL()
    expect(await screen.findByText('GANCHO')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('BANNER')).toBeNull()
  })

  it('"Agora não" marca como vista, fecha e libera o banner', async () => {
    renderCL()
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
    expect(api.fetch).toHaveBeenCalledWith('/referrals/celebration/seen', {
      method: 'POST',
      body: JSON.stringify(referrerCelebration.seen),
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('BANNER')).toBeInTheDocument()
  })

  it('CTA "Indicar mais" fecha e vai para a tela do programa', async () => {
    renderCL()
    fireEvent.click(await screen.findByRole('button', { name: 'Indicar mais' }))
    expect(await screen.findByText('TELA INDIQUE')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sem comemoração: o banner abre depois que o resumo chega', async () => {
    api.summary = summaryWith(null)
    renderCL()
    expect(await screen.findByText('BANNER')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resumo falhando não trava o banner', async () => {
    api.fetch.mockImplementation((path: string) => {
      if (path === '/referrals/summary') return Promise.reject(new Error('offline'))
      const body = path === '/client/onboarding' ? { completed: true } : {}
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    })
    renderCL()
    await waitFor(() => expect(screen.getByText('BANNER')).toBeInTheDocument())
  })
})
