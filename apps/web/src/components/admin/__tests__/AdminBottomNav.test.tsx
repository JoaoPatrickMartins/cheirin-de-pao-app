// AdminBottomNav unit tests
// Requirements: navegação inferior Admin — 6 abas (Painel · Pedidos · Separação · Entregas · Clientes · Gestão)
// O logout foi movido para o fim da aba Gestão (não fica mais na bottom nav).
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdminBottomNav } from '../AdminBottomNav.js'

describe('AdminBottomNav', () => {
  it('renderiza 6 abas de navegação e marca a aba ativa', () => {
    const onTabChange = vi.fn()
    render(<AdminBottomNav activeTab="painel" onTabChange={onTabChange} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)

    const activeButton = screen.getByRole('button', { name: 'Painel' })
    expect(activeButton).toHaveAttribute('aria-current', 'page')
  })

  it('inclui as abas Pedidos e Separação', () => {
    const onTabChange = vi.fn()
    render(<AdminBottomNav activeTab="painel" onTabChange={onTabChange} />)

    expect(screen.getByRole('button', { name: 'Pedidos' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Separação' })).toBeDefined()
  })

  it('não renderiza mais o botão Sair (movido para a Gestão)', () => {
    const onTabChange = vi.fn()
    render(<AdminBottomNav activeTab="painel" onTabChange={onTabChange} />)

    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })

  it('renderiza com aria-label de navegação administrativa', () => {
    const onTabChange = vi.fn()
    render(<AdminBottomNav activeTab="pedido" onTabChange={onTabChange} />)

    const nav = screen.getByRole('navigation', { name: 'Navegação administrativa' })
    expect(nav).toBeDefined()
  })

  it('marca a aba correta como ativa quando activeTab é gestao', () => {
    const onTabChange = vi.fn()
    render(<AdminBottomNav activeTab="gestao" onTabChange={onTabChange} />)

    const gestaoButton = screen.getByRole('button', { name: 'Gestão' })
    expect(gestaoButton).toHaveAttribute('aria-current', 'page')

    const painelButton = screen.getByRole('button', { name: 'Painel' })
    expect(painelButton).not.toHaveAttribute('aria-current', 'page')
  })
})
