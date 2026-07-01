// ClientTabBar component tests
// Requirements: UI-08 (5 abas com labels corretos; aba ativa com cor diferente)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ClientTabBar } from '../ClientTabBar'

describe('ClientTabBar [UI-08]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('renderizacao das abas', () => {
    it('renderiza exatamente 5 abas de navegacao', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(5)
    })

    it('aba "Inicio" esta presente com label correto', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      expect(screen.getByText('Início')).toBeDefined()
    })

    it('aba "Agenda" esta presente com label correto', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      expect(screen.getByText('Agenda')).toBeDefined()
    })

    it('aba "Pães" esta presente com label correto', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      expect(screen.getByText('Pães')).toBeDefined()
    })

    it('aba "Pedidos" esta presente com label correto', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      expect(screen.getByText('Pedidos')).toBeDefined()
    })

    it('aba "Perfil" esta presente com label correto', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      expect(screen.getByText('Perfil')).toBeDefined()
    })
  })

  describe('estado ativo', () => {
    it('aba ativa tem data-active="true" diferente das inativas', () => {
      render(
        <MemoryRouter initialEntries={['/client/home']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      const activeButtons = screen.getAllByRole('button').filter(
        btn => btn.getAttribute('data-active') === 'true'
      )
      expect(activeButtons).toHaveLength(1)
    })

    it('apenas uma aba esta ativa por vez', () => {
      render(
        <MemoryRouter initialEntries={['/client/creditos']}>
          <ClientTabBar />
        </MemoryRouter>
      )
      const activeButtons = screen.getAllByRole('button').filter(
        btn => btn.getAttribute('data-active') === 'true'
      )
      expect(activeButtons).toHaveLength(1)
    })
  })
})
