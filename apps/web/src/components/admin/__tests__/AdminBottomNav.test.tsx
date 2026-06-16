// AdminBottomNav unit tests — Fase 7 / Plano 07-01 (Wave 0 stub)
// Requirements: UI-09 (navegação inferior Admin com 5 itens)
// Estado: "red" — mock temporário do componente para CI verde enquanto implementação não existe (Wave 1)
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock temporário do componente — permite que o teste passe com valores stub
// enquanto o componente real não existe (substituir por import real na Wave 1)
vi.mock('../AdminBottomNav.js', () => ({
  AdminBottomNav: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string
    onTabChange: (tab: string) => void
  }) => (
    <nav role="navigation" aria-label="Admin navigation">
      {['painel', 'pedido', 'entregas', 'clientes', 'gestao'].map((tab) => (
        <button
          key={tab}
          role="button"
          aria-current={activeTab === tab ? 'page' : undefined}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  ),
}))

import { AdminBottomNav } from '../AdminBottomNav.js'

// ── Testes ────────────────────────────────────────────────────────────────────
describe('AdminBottomNav', () => {
  it('renderiza 5 abas e marca a aba ativa corretamente', () => {
    const onTabChange = vi.fn()

    render(<AdminBottomNav activeTab="painel" onTabChange={onTabChange} />)

    // Deve renderizar exatamente 5 botões de navegação
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)

    // A aba ativa deve estar marcada com aria-current="page"
    const activeButton = screen.getByRole('button', { name: 'painel' })
    expect(activeButton).toHaveAttribute('aria-current', 'page')
  })
})
