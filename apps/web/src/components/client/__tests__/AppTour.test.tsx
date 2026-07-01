// Fase B — Tour do App (driver.js). jsdom não faz layout, então mockamos
// driver.js e testamos a orquestração (steps/ordem/callbacks), não a posição.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

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

  it('encerrar sem concluir chama onFinish (sem badge)', () => {
    const onFinish = renderWithAnchor()
    act(() => h.config.onDestroyed(undefined, {}, {}))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Bem-Vindo/)).toBeNull()
  })

  it('concluir exibe o badge de boas-vindas e finaliza após o timer', () => {
    vi.useFakeTimers()
    const onFinish = renderWithAnchor()
    const fakeDriver = { isLastStep: () => true, destroy: vi.fn() }
    // "Concluir" na última parada
    act(() => h.config.onNextClick(undefined, {}, { driver: fakeDriver }))
    expect(fakeDriver.destroy).toHaveBeenCalled()
    // driver.destroy real dispara onDestroyed — simulamos:
    act(() => h.config.onDestroyed(undefined, {}, {}))
    expect(screen.getByText(/Bem-Vindo/)).toBeTruthy()
    expect(onFinish).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1800))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
