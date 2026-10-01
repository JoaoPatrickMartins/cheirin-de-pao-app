// Fase B — Tour do App (driver.js). jsdom não faz layout, então mockamos
// driver.js e testamos a orquestração (steps/ordem/callbacks), não a posição.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: null as any,
  drive: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock('driver.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  driver: (config: any) => {
    h.config = config
    return {
      drive: h.drive,
      destroy: h.destroy,
      isActive: () => false,
      isLastStep: () => false,
      moveNext: vi.fn(),
      movePrevious: vi.fn(),
    }
  },
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'CLIENT', name: 'Ana' } }),
}))

import { AppTour } from '../AppTour'

function renderWithAnchor(onFinish = vi.fn()) {
  render(
    <>
      <div data-tour="saldo" />
      <AppTour onFinish={onFinish} />
    </>,
  )
  return onFinish
}

describe('AppTour (tour do app)', () => {
  beforeEach(() => {
    h.config = null
    h.drive.mockClear()
    h.destroy.mockClear()
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('monta as 6 paradas na ordem e chama drive()', () => {
    renderWithAnchor()
    expect(h.config).toBeTruthy()
    expect(h.config.steps).toHaveLength(6)
    expect(h.config.steps.map((s: { element: string }) => s.element)).toEqual([
      '[data-tour="saldo"]',
      '[data-tour="comprar-paes"]',
      '[data-tour="entrega-hoje"]',
      '[data-tour="pedido-avulso"]',
      '[data-tour="tab-agenda"]',
      '[data-tour="tab-perfil"]',
    ])
    expect(h.config.showProgress).toBe(false) // progresso próprio (topo) + dots (rodapé)
    expect(h.drive).toHaveBeenCalled()
  })

  it('encerrar sem concluir chama onFinish direto (sem o card final)', () => {
    const onFinish = renderWithAnchor()
    act(() => h.config.onDestroyed(undefined, {}, {}))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // "Concluir" na última parada → driver.destroy real dispara onDestroyed (simulado).
  function completeTour() {
    const fakeDriver = { isLastStep: () => true, destroy: vi.fn() }
    act(() => h.config.onNextClick(undefined, {}, { driver: fakeDriver }))
    expect(fakeDriver.destroy).toHaveBeenCalled()
    act(() => h.config.onDestroyed(undefined, {}, {}))
  }

  it('concluir mostra o card final e espera a escolha (não finaliza sozinho)', () => {
    vi.useFakeTimers()
    const onFinish = renderWithAnchor()
    completeTour()
    expect(screen.getByRole('dialog', { name: 'Bem-vindo ao Cheirin de Pão!' })).toBeTruthy()
    // "Começar a usar" é a ação principal: recebe o foco (Enter fecha o card).
    expect(screen.getByRole('button', { name: 'Começar a usar' })).toHaveFocus()
    act(() => vi.advanceTimersByTime(10_000))
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('"Começar a usar" fecha e finaliza sem destino', () => {
    const onFinish = renderWithAnchor()
    completeTour()
    fireEvent.click(screen.getByRole('button', { name: 'Começar a usar' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith()
  })

  it('"Saber mais sobre o Cheirin" finaliza com destino /sobre/ e trava em "Abrindo…"', () => {
    const onFinish = renderWithAnchor()
    completeTour()
    fireEvent.click(screen.getByRole('button', { name: /Saber mais sobre o Cheirin/ }))
    expect(onFinish).toHaveBeenCalledWith('sobre')
    const busy = screen.getByRole('button', { name: 'Abrindo…' })
    expect(busy).toBeDisabled()
    fireEvent.click(busy)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('Esc e toque no fundo fecham como "Começar a usar"', () => {
    const onFinish = renderWithAnchor()
    completeTour()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onFinish).toHaveBeenCalledWith()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onFinish).toHaveBeenCalledTimes(2)
  })
})
