import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { useOrderTracking } from '../useOrderTracking'

describe('useOrderTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'order-1',
          status: 'SCHEDULED',
          quantity: 2,
          scheduledDate: '2026-06-16',
        }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chama clearInterval quando o componente é desmontado', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useOrderTracking())
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('não faz mais chamadas após o componente ser desmontado', async () => {
    const { unmount } = renderHook(() => useOrderTracking())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    unmount()
    mockApiFetch.mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('faz fetch imediato na montagem', async () => {
    renderHook(() => useOrderTracking())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
  })

  it('faz poll a cada 30s', async () => {
    renderHook(() => useOrderTracking())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockApiFetch).toHaveBeenCalledTimes(2)
  })

  it('HTTP 404 → order = null', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 404 })
    const { result } = renderHook(() => useOrderTracking())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.order).toBeNull()
  })
})
