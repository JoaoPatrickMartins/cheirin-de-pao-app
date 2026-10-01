// Component will be created in Plan 03 — test stubs only
// Requirements: UI-05 (Splash screen with espresso background + gold symbol)
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// O hook de instalação lê o matchMedia, que o jsdom não tem.
vi.mock('../../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ isInstallable: false, isIOS: false, isStandalone: false, triggerInstall: vi.fn() }),
}))

import { SplashScreen } from './SplashScreen'

describe('SplashScreen [UI-05]', () => {
  it.todo('renders espresso background')
  it.todo('shows install CTA')

  // B1 do handoff da página Sobre: a /sobre/ é HTML estático, fora do router — link comum.
  it('link "Saiba como o Cheirin funciona" leva à página pública /sobre/', () => {
    render(
      <MemoryRouter>
        <SplashScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Saiba como o Cheirin funciona/ })).toHaveAttribute('href', '/sobre/')
  })
})
