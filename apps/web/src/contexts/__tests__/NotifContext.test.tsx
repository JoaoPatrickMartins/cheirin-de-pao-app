// NotifContext tests
// Requirements: ACOMP-05 (badge sincronizado entre HomeScreen e NotificationsScreen)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import React from 'react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { NotifProvider, useNotif } from '../NotifContext'

describe('NotifContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    })
  })

  it('Caso 1: NotifProvider renderiza children sem erro', () => {
    render(
      <NotifProvider>
        <div data-testid="child">filho</div>
      </NotifProvider>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('Caso 2: useNotif() fora de NotifProvider retorna valor default { unreadCount: 0 }', () => {
    const { result } = renderHook(() => useNotif())
    expect(result.current.unreadCount).toBe(0)
    expect(typeof result.current.refresh).toBe('function')
  })

  it('Caso 3: NotifProvider faz fetch de /notifications/unread-count no mount e atualiza unreadCount', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 3 }),
    })

    const TestConsumer = () => {
      const { unreadCount } = useNotif()
      return <div data-testid="count">{unreadCount}</div>
    }

    render(
      <NotifProvider>
        <TestConsumer />
      </NotifProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('3')
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/notifications/unread-count')
  })

  it('Caso 4: refresh() re-faz o fetch e atualiza unreadCount (apiFetch chamado 2x)', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 5 }),
    })

    const TestConsumer = () => {
      const { unreadCount, refresh } = useNotif()
      return (
        <div>
          <div data-testid="count">{unreadCount}</div>
          <button data-testid="refresh-btn" onClick={() => void refresh()}>
            refresh
          </button>
        </div>
      )
    }

    render(
      <NotifProvider>
        <TestConsumer />
      </NotifProvider>
    )

    // aguarda fetch do mount
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    // chama refresh() manualmente
    await act(async () => {
      screen.getByTestId('refresh-btn').click()
    })

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('Caso 5: falha de fetch mantém estado anterior (unreadCount permanece 0, sem exceção)', async () => {
    mockApiFetch.mockRejectedValue(new Error('network error'))

    const TestConsumer = () => {
      const { unreadCount } = useNotif()
      return <div data-testid="count">{unreadCount}</div>
    }

    render(
      <NotifProvider>
        <TestConsumer />
      </NotifProvider>
    )

    // aguarda resolução do efeito — unreadCount deve permanecer 0
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByTestId('count').textContent).toBe('0')
  })
})
