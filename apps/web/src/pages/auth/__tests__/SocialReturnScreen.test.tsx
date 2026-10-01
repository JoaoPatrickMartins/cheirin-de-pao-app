// Tela de retorno do login com Google (handoff L3a/L3b/L3c/L6 — plano-login-social.md §5.4).
import { StrictMode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
// `unstable`: o finishAuth ganha identidade nova a cada render, como quando o AuthProvider termina de hidratar.
const finish = vi.hoisted(() => ({ fn: vi.fn(), unstable: false }))
const nav = vi.hoisted(() => ({ goToProvider: vi.fn() }))

vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch, getDeviceId: () => 'device-1' }))
vi.mock('../../../lib/finishAuth', () => ({
  useFinishAuth: () => (finish.unstable ? (...args: unknown[]) => finish.fn(...args) : finish.fn),
}))
vi.mock('../../../lib/socialAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/socialAuth')>()),
  goToProvider: nav.goToProvider,
}))

import { SocialReturnScreen } from '../SocialReturnScreen'

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
}

const FLOW = {
  flowId: 'flow1',
  secret: 's'.repeat(43),
  provider: 'google',
  origin: 'login',
  displayMode: 'browser',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
  createdAt: Date.now(),
}

function savePending(overrides: Record<string, unknown> = {}) {
  localStorage.setItem('cdp_social_flow', JSON.stringify({ ...FLOW, ...overrides }))
}

function StateProbe({ label }: { label: string }) {
  const loc = useLocation()
  return (
    <div>
      {label} {loc.search} {JSON.stringify(loc.state ?? null)}
    </div>
  )
}

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/entrar/social" element={<SocialReturnScreen />} />
        <Route path="/login" element={<StateProbe label="LOGIN" />} />
        <Route path="/register" element={<StateProbe label="REGISTER" />} />
        <Route path="/client/perfil/conta" element={<StateProbe label="CONTA" />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderAt(path: string) {
  return render(tree(path))
}

/** Como a API: o 1º claim leva o LOGGED_IN (segura até `release`); os seguintes, "expirou". */
function serverDeliversOnce(session: unknown) {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  api.fetch
    .mockImplementationOnce(() => gate.then(() => json(200, session)))
    .mockImplementation(() => json(200, { status: 'ERROR', code: 'expired' }))
  return release
}

beforeEach(() => {
  api.fetch.mockReset()
  finish.fn.mockReset()
  finish.unstable = false
  nav.goToProvider.mockReset()
  localStorage.clear()
  sessionStorage.clear()
})

describe('SocialReturnScreen', () => {
  it('voltou numa janela sem o segredo (Safari do iPhone) → "Pode voltar ao app", sem claim', () => {
    renderAt('/entrar/social?flow=flow1')
    expect(screen.getByText('Pronto!')).toBeInTheDocument()
    expect(api.fetch).not.toHaveBeenCalled()
  })

  it('começou no app instalado e voltou no navegador → "Pode voltar ao app"', () => {
    savePending({ displayMode: 'standalone' })
    renderAt('/entrar/social?flow=flow1')
    expect(screen.getByText('Pronto!')).toBeInTheDocument()
  })

  it('logo depois do start: abre o Google uma vez e mostra "Conectando…"', async () => {
    savePending()
    api.fetch.mockReturnValue(json(200, { status: 'PENDING' }))
    renderAt('/entrar/social')
    expect(screen.getByText('Conectando com o Google…')).toBeInTheDocument()
    await waitFor(() => expect(nav.goToProvider).toHaveBeenCalledWith(FLOW.authUrl))
    expect(nav.goToProvider).toHaveBeenCalledTimes(1)
  })

  it('LOGGED_IN → abre a sessão (método google) e limpa o fluxo', async () => {
    savePending()
    const session = { status: 'LOGGED_IN', accessToken: 'a', refreshToken: 'r', hasPassword: false, mustSetPassword: false, user: { id: 'u1', role: 'CLIENT', name: 'Marina' } }
    api.fetch.mockReturnValue(json(200, session))
    renderAt('/entrar/social?flow=flow1')

    await waitFor(() => expect(finish.fn).toHaveBeenCalledWith(session, 'google', { replace: true }))
    expect(localStorage.getItem('cdp_social_flow')).toBeNull()
  })

  // Bug do teste real (01/10/2026): o efeito da busca rodava de novo com o 1º claim no ar; o 1º levava
  // os tokens e era descartado, o 2º recebia "expirou" → "Demorou um pouquinho." com o login feito.
  it('StrictMode (dev): o efeito em dobro não descarta o login que a API entrega uma vez só', async () => {
    savePending()
    const session = { status: 'LOGGED_IN', accessToken: 'a', refreshToken: 'r', hasPassword: false, mustSetPassword: false, user: { id: 'u1', role: 'CLIENT', name: 'Marina' } }
    const release = serverDeliversOnce(session)
    render(<StrictMode>{tree('/entrar/social?flow=flow1')}</StrictMode>)
    release()

    await waitFor(() => expect(finish.fn).toHaveBeenCalledWith(session, 'google', { replace: true }))
    expect(screen.queryByText('Demorou um pouquinho.')).not.toBeInTheDocument()
  })

  it('a sessão terminar de carregar no meio da busca (finishAuth novo) não descarta o login', async () => {
    savePending()
    finish.unstable = true
    const session = { status: 'LOGGED_IN', accessToken: 'a', refreshToken: 'r', hasPassword: false, mustSetPassword: false, user: { id: 'u1', role: 'CLIENT', name: 'Marina' } }
    const release = serverDeliversOnce(session)
    const { rerender } = renderAt('/entrar/social?flow=flow1')
    rerender(tree('/entrar/social?flow=flow1'))
    release()

    await waitFor(() => expect(finish.fn).toHaveBeenCalledWith(session, 'google', { replace: true }))
    expect(screen.queryByText('Demorou um pouquinho.')).not.toBeInTheDocument()
  })

  it('NEEDS_SIGNUP → cadastro "Quase lá" com o prefill (o fluxo continua guardado)', async () => {
    savePending({ origin: 'register' })
    api.fetch.mockReturnValue(json(200, { status: 'NEEDS_SIGNUP', prefill: { name: 'Marina Ribeiro', email: 'marina@gmail.com', provider: 'google' } }))
    renderAt('/entrar/social?flow=flow1')

    expect(await screen.findByText(/REGISTER \?modo=google/)).toBeInTheDocument()
    expect(screen.getByText(/Marina Ribeiro/)).toBeInTheDocument()
    expect(localStorage.getItem('cdp_social_flow')).not.toBeNull()
  })

  it('cancelou no Google saindo do login → volta ao login com o aviso', async () => {
    savePending()
    api.fetch.mockReturnValue(json(200, { status: 'ERROR', code: 'cancelled' }))
    renderAt('/entrar/social?flow=flow1')
    expect(await screen.findByText(/LOGIN .*"socialError":"cancelled"/)).toBeInTheDocument()
  })

  it('conta bloqueada → L3c "Conta bloqueada."', async () => {
    savePending()
    api.fetch.mockReturnValue(json(200, { status: 'ERROR', code: 'blocked' }))
    renderAt('/entrar/social?flow=flow1')
    expect(await screen.findByText('Conta bloqueada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Falar com o suporte/ })).toBeInTheDocument()
  })

  it('erro direto na URL (?erro=expired) → "Demorou um pouquinho."', () => {
    renderAt('/entrar/social?erro=expired')
    expect(screen.getByText('Demorou um pouquinho.')).toBeInTheDocument()
  })

  it('NEEDS_LINK → "Encontramos sua conta"; senha certa conecta, entra e deixa o aviso', async () => {
    savePending()
    const session = { status: 'LOGGED_IN', accessToken: 'a', refreshToken: 'r', hasPassword: true, mustSetPassword: false, user: { id: 'u1', role: 'CLIENT', name: 'Marina' } }
    api.fetch
      .mockReturnValueOnce(json(200, { status: 'NEEDS_LINK', maskedEmail: 'ma•••@gmail.com', canUsePassword: true }))
      .mockReturnValueOnce(json(200, session))
    renderAt('/entrar/social?flow=flow1')

    expect(await screen.findByText('Encontramos sua conta.')).toBeInTheDocument()
    expect(screen.getByText('ma•••@gmail.com')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Senha da sua conta'), { target: { value: 'Senha123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e conectar' }))

    await waitFor(() => expect(finish.fn).toHaveBeenCalledWith(session, 'google', { replace: true }))
    expect(api.fetch.mock.calls[1][0]).toBe('/auth/social/link/password')
    expect(sessionStorage.getItem('cdp_flash')).toBe('Google conectado! Da próxima vez é só um toque.')
  })

  it('NEEDS_LINK sem senha na conta → só "Receber código no e-mail"', async () => {
    savePending()
    api.fetch.mockReturnValue(json(200, { status: 'NEEDS_LINK', maskedEmail: 'ma•••@gmail.com', canUsePassword: false }))
    renderAt('/entrar/social?flow=flow1')

    expect(await screen.findByRole('button', { name: /Receber código no e-mail/ })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Senha da sua conta')).not.toBeInTheDocument()
  })

  it('senha errada mostra o erro no campo e o fluxo segue', async () => {
    savePending()
    api.fetch
      .mockReturnValueOnce(json(200, { status: 'NEEDS_LINK', maskedEmail: 'ma•••@gmail.com', canUsePassword: true }))
      .mockReturnValueOnce(json(401, { error: 'Senha incorreta.', reason: 'password_wrong', attemptsLeft: 4 }))
    renderAt('/entrar/social?flow=flow1')

    fireEvent.change(await screen.findByPlaceholderText('Senha da sua conta'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e conectar' }))
    expect(await screen.findByText(/Senha não confere/)).toBeInTheDocument()
    expect(finish.fn).not.toHaveBeenCalled()
  })
})
