// usePaymentPolling hook tests
// Requirements: cleanup clearInterval (sem memory leak), MAX_ATTEMPTS = 5
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { usePaymentPolling } from '../usePaymentPolling'

describe('usePaymentPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('cleanup sem memory leak', () => {
    it('chama clearInterval quando o componente e desmontado (cleanup)', async () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
      const { unmount } = renderHook(() => usePaymentPolling('payment-1', vi.fn()))
      unmount()
      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('nao faz mais chamadas apos o componente ser desmontado', async () => {
      const { unmount } = renderHook(() => usePaymentPolling('payment-1', vi.fn()))
      unmount()
      mockApiFetch.mockClear()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
      expect(mockApiFetch).not.toHaveBeenCalled()
    })
  })

  describe('MAX_ATTEMPTS = 5', () => {
    it('para de fazer polling apos 5 tentativas (isTimeout = true)', async () => {
      const { result } = renderHook(() => usePaymentPolling('payment-1', vi.fn()))
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000)
        })
      }
      expect(result.current.isTimeout).toBe(true)
    })

    it('faz exatamente MAX_ATTEMPTS = 5 chamadas antes de parar', async () => {
      renderHook(() => usePaymentPolling('payment-1', vi.fn()))
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000)
        })
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9000)
      })
      expect(mockApiFetch).toHaveBeenCalledTimes(5)
    })

    it('para de fazer polling imediatamente quando status e approved', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'approved', creditBalance: 42 }),
      })
      const onApproved = vi.fn()
      renderHook(() => usePaymentPolling('payment-1', onApproved))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
      expect(onApproved).toHaveBeenCalledWith(42)
      mockApiFetch.mockClear()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9000)
      })
      expect(mockApiFetch).not.toHaveBeenCalled()
    })
  })
})
