// Guarda das rotas públicas (splash/login/cadastro).
// Usuário autenticado vai direto para a home do perfil; deslogado vê a rota pública;
// durante a reidratação da sessão (isLoading) mostra o LoadingScreen — sem flash da splash.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

const auth = vi.hoisted(() => ({
  state: { user: null as unknown, isLoading: false },
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth.state }))
vi.mock('../../pages/auth/LoadingScreen', () => ({
  LoadingScreen: () => <div>LOADING</div>,
}))

import { RedirectIfAuthenticated } from '../RedirectIfAuthenticated'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/" element={<div>SPLASH</div>} />
          <Route path="/login" element={<div>LOGIN</div>} />
        </Route>
        <Route path="/client" element={<div>CLIENT HOME</div>} />
        <Route path="/admin" element={<div>ADMIN HOME</div>} />
        <Route path="/set-password" element={<div>SET PASSWORD</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RedirectIfAuthenticated', () => {
  beforeEach(() => {
    auth.state.user = null
    auth.state.isLoading = false
  })

  it('mostra a rota pública quando não há sessão', () => {
    renderAt('/')
    expect(screen.getByText('SPLASH')).toBeInTheDocument()
  })

  it('mostra o loading enquanto a sessão reidrata (sem flash da splash)', () => {
    auth.state.isLoading = true
    renderAt('/')
    expect(screen.getByText('LOADING')).toBeInTheDocument()
    expect(screen.queryByText('SPLASH')).not.toBeInTheDocument()
  })

  it('redireciona usuário CLIENT logado para a home do cliente', () => {
    auth.state.user = { id: 'u1', role: 'CLIENT', name: 'Ana', hasPassword: true }
    renderAt('/')
    expect(screen.getByText('CLIENT HOME')).toBeInTheDocument()
  })

  it('redireciona a partir de /login também (não só da splash)', () => {
    auth.state.user = { id: 'a1', role: 'ADMIN', name: 'Adm', hasPassword: true }
    renderAt('/login')
    expect(screen.getByText('ADMIN HOME')).toBeInTheDocument()
  })

  it('força a definição de senha no 1º acesso (hasPassword === false)', () => {
    auth.state.user = { id: 'u2', role: 'CLIENT', name: 'Bia', hasPassword: false }
    renderAt('/')
    expect(screen.getByText('SET PASSWORD')).toBeInTheDocument()
  })
})
