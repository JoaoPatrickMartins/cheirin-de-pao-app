// Telas com o login com Google: L1 (login), L2 (escolha do cadastro), L4 ("Quase lá"), L8 (criar
// senha) e L7 (contas conectadas) — plano-login-social.md §9.2.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

const api = vi.hoisted(() => ({ routes: {} as Record<string, { status: number; body: unknown }>, calls: [] as { path: string; init?: RequestInit }[] }))
const auth = vi.hoisted(() => ({
  state: {
    user: null as Record<string, unknown> | null,
    isLoading: false,
    login: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('../../../lib/apiFetch', () => ({
  getDeviceId: () => 'device-1',
  apiFetch: (path: string, init?: RequestInit) => {
    api.calls.push({ path, init })
    const hit = api.routes[path] ?? { status: 404, body: {} }
    return Promise.resolve({ ok: hit.status >= 200 && hit.status < 300, status: hit.status, json: () => Promise.resolve(hit.body) })
  },
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth.state }))
vi.mock('../../../lib/finishAuth', () => ({ useFinishAuth: () => vi.fn() }))

import { LoginScreen } from '../LoginScreen'
import { OnboardingScreen } from '../OnboardingScreen'
import { CreatePasswordScreen } from '../CreatePasswordScreen'
import { AccountScreen } from '../../client/AccountScreen'
import { resetSocialProvidersCache } from '../../../lib/socialAuth'

function route(path: string, status: number, body: unknown) {
  api.routes[path] = { status, body }
}

function renderAt(path: string, element: React.ReactNode, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
      <Routes>
        <Route path={path.split('?')[0]} element={element} />
        <Route path="/entrar/social" element={<div>RETORNO</div>} />
        <Route path="/client/perfil/conta" element={<div>CONTA</div>} />
        <Route path="/change-password" element={<div>TROCAR SENHA</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.routes = {}
  api.calls = []
  auth.state.user = null
  auth.state.login.mockReset()
  auth.state.updateUser.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  resetSocialProvidersCache()
  route('/referrals/config', 200, { active: false })
  route('/condominiums', 200, [])
})

describe('L1 — login', () => {
  it('Google ligado: botão, "ou com e-mail" e consentimento', async () => {
    route('/auth/social/providers', 200, { google: true })
    renderAt('/login', <LoginScreen />)

    expect(await screen.findByRole('button', { name: /Continuar com o Google/ })).toBeInTheDocument()
    expect(screen.getByText('ou com e-mail')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade')
    expect(screen.getByText(/O jeito mais rápido é com um toque/)).toBeInTheDocument()
  })

  it('Google desligado: igual a antes (sem botão, sem divisor)', async () => {
    route('/auth/social/providers', 200, { google: false })
    renderAt('/login', <LoginScreen />)

    expect(await screen.findByText(/Entre com seu e-mail e senha/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continuar com o Google/ })).not.toBeInTheDocument()
    expect(screen.queryByText('ou com e-mail')).not.toBeInTheDocument()
  })

  it('tocar no Google inicia o fluxo e vai para a tela de retorno', async () => {
    route('/auth/social/providers', 200, { google: true })
    route('/auth/social/google/start', 200, { flowId: 'f1', secret: 'x'.repeat(43), authUrl: 'https://accounts.google.com/a' })
    renderAt('/login', <LoginScreen />)

    fireEvent.click(await screen.findByRole('button', { name: /Continuar com o Google/ }))
    expect(await screen.findByText('RETORNO')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('cdp_social_flow')!)).toMatchObject({ flowId: 'f1', origin: 'login' })
  })

  it('voltou porque cancelou: aviso "Não deu certo desta vez."', async () => {
    route('/auth/social/providers', 200, { google: true })
    renderAt('/login', <LoginScreen />, { socialError: 'cancelled' })
    expect(await screen.findByText('Você cancelou o login com o Google.')).toBeInTheDocument()
  })
})

describe('L2 + L4 — cadastro', () => {
  it('com o Google ligado, abre na escolha; "Criar com e-mail" vai ao passo 1 de sempre', async () => {
    route('/auth/social/providers', 200, { google: true })
    renderAt('/register', <OnboardingScreen />)

    expect(await screen.findByText('Como você quer criar sua conta?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Criar com e-mail/ }))
    expect(await screen.findByText('Seus dados')).toBeInTheDocument()
  })

  it('sem o Google, vai direto ao passo 1', async () => {
    route('/auth/social/providers', 200, { google: false })
    renderAt('/register', <OnboardingScreen />)
    expect(await screen.findByText('Seus dados')).toBeInTheDocument()
  })

  it('"Quase lá": nome preenchido, e-mail travado, sem senha; libera com CPF, nascimento e celular', async () => {
    route('/auth/social/providers', 200, { google: true })
    localStorage.setItem(
      'cdp_social_flow',
      JSON.stringify({ flowId: 'f1', secret: 'x'.repeat(43), provider: 'google', origin: 'register', displayMode: 'browser', authUrl: 'u', createdAt: Date.now() }),
    )
    renderAt('/register?modo=google', <OnboardingScreen />, { prefill: { name: 'Marina Ribeiro', email: 'marina@gmail.com' } })

    expect(await screen.findByText('Quase lá, Marina!')).toBeInTheDocument()
    expect(screen.getByText('marina@gmail.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Marina Ribeiro')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/senha/i)).not.toBeInTheDocument()

    const continuar = screen.getByRole('button', { name: 'Continuar' })
    expect(continuar).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '52998224725' } })
    fireEvent.change(screen.getByPlaceholderText('DD / MM / AAAA'), { target: { value: '10051990' } })
    fireEvent.change(screen.getByPlaceholderText('(11) 9 0000-0000'), { target: { value: '11990001234' } })
    expect(continuar).toBeEnabled()

    fireEvent.click(continuar)
    expect(await screen.findByText('Onde você mora?')).toBeInTheDocument()
  })
})

describe('L8 — criar senha', () => {
  beforeEach(() => {
    auth.state.user = { id: 'u1', role: 'CLIENT', name: 'Marina', hasPassword: false }
  })

  it('usa a regra real: sem maiúscula não libera; forte e igual libera e cria', async () => {
    route('/auth/password/set', 200, { ok: true })
    renderAt('/create-password', <CreatePasswordScreen />)

    const nova = screen.getByPlaceholderText('Crie uma senha')
    const repete = screen.getByPlaceholderText('Repita a senha')
    const criar = screen.getByRole('button', { name: 'Criar senha' })

    fireEvent.change(nova, { target: { value: 'pao2026ok' } })
    fireEvent.change(repete, { target: { value: 'pao2026ok' } })
    expect(criar).toBeDisabled() // o handoff aceitaria; a API não (V-2)

    fireEvent.change(nova, { target: { value: 'Pao2026ok' } })
    fireEvent.change(repete, { target: { value: 'Pao2026ok' } })
    expect(criar).toBeEnabled()
    fireEvent.click(criar)

    expect(await screen.findByText('Senha criada.')).toBeInTheDocument()
    expect(auth.state.updateUser).toHaveBeenCalledWith({ hasPassword: true, mustSetPassword: false })
  })

  it('conta que já tem senha vai para "Trocar senha"', () => {
    auth.state.user = { id: 'u1', role: 'CLIENT', name: 'Marina', hasPassword: true }
    renderAt('/create-password', <CreatePasswordScreen />)
    expect(screen.getByText('TROCAR SENHA')).toBeInTheDocument()
  })
})

describe('L7 + L8 — Minha conta', () => {
  it('Google conectado e sem senha: "Você entra com o Google" + Criar senha; desconectar pede confirmação', async () => {
    auth.state.user = { id: 'u1', role: 'CLIENT', name: 'Marina', hasPassword: false, email: 'marina@gmail.com' }
    route('/auth/social/providers', 200, { google: true })
    route('/auth/social/accounts', 200, [{ provider: 'google', email: 'marina@gmail.com', linkedAt: '2026-09-30T00:00:00.000Z' }])
    route('/auth/social/google', 200, { ok: true })
    renderAt('/client/perfil/conta-teste', <AccountScreen />)

    expect(await screen.findByText('Você entra com o Google')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar senha' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    expect(screen.getByRole('dialog', { name: 'Desconectar o Google?' })).toBeInTheDocument()
    expect(screen.getByText(/Você continua entrando com código no e-mail\./)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Desconectar/ }).at(-1)!)
    await waitFor(() => expect(api.calls.some((c) => c.path === '/auth/social/google' && c.init?.method === 'DELETE')).toBe(true))
    expect(await screen.findByText('Google desconectado. O código no e-mail continua valendo.')).toBeInTheDocument()
  })

  it('com senha e sem Google: Trocar + botão Conectar', async () => {
    auth.state.user = { id: 'u1', role: 'CLIENT', name: 'Marina', hasPassword: true }
    route('/auth/social/providers', 200, { google: true })
    route('/auth/social/accounts', 200, [])
    renderAt('/client/perfil/conta-teste', <AccountScreen />)

    expect(await screen.findByRole('button', { name: 'Conectar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeInTheDocument()
  })
})
