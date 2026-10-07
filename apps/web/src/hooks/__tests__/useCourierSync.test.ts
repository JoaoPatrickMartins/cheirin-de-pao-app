// useCourierSync (Onda 4): reenvia ao voltar o sinal, ao reabrir o app e a cada 30 s; avisa cada
// operação concluída; "sem sinal" aparece só quando o envio parou por falta de rede.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { QueuedOp, SendOutcome } from '../../lib/courierQueue'

const mockSend = vi.hoisted(() => vi.fn<(op: QueuedOp) => Promise<SendOutcome>>())
vi.mock('../../lib/courierApi', () => ({ sendQueuedOp: mockSend }))

import { useCourierSync, SYNC_INTERVAL_MS } from '../useCourierSync'
import { resetCourierQueue } from '../../lib/courierQueue'

const op = (id: string): QueuedOp => ({
  id,
  courierId: 'k1',
  stopKey: `s-${id}`,
  occurredAt: '2026-10-02T09:00:00.000Z',
  createdAt: Number(id.replace(/\D/g, '')) || 1,
  attempts: 0,
  kind: 'confirm',
  target: { kind: 'BREAD', id },
  via: 'SCAN',
})

beforeEach(() => {
  resetCourierQueue()
  mockSend.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('useCourierSync', () => {
  it('sem sinal guarda e marca offline; o evento "online" envia e avisa', async () => {
    mockSend.mockResolvedValue({ kind: 'retry', network: true })
    const onResult = vi.fn()
    const { result } = renderHook(() => useCourierSync('k1', onResult))
    await act(async () => {
      await result.current.enqueue(op('op1'))
    })
    await waitFor(() => expect(result.current.offline).toBe(true))
    expect(result.current.ops).toHaveLength(1)

    mockSend.mockResolvedValue({ kind: 'done' })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current.ops).toHaveLength(0))
    expect(result.current.offline).toBe(false)
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ id: 'op1' }), { kind: 'done' })
  })

  it('reabrir o app (visibilitychange) e o intervalo de 30 s também reenviam', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockSend.mockResolvedValue({ kind: 'retry', network: false })
    const { result } = renderHook(() => useCourierSync('k1'))
    await act(async () => {
      await result.current.enqueue(op('op1'))
    })
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1))
    // Erro do servidor não é "sem sinal".
    expect(result.current.offline).toBe(false)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2))

    await act(async () => {
      vi.advanceTimersByTime(SYNC_INTERVAL_MS)
    })
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(3))
    expect(result.current.ops[0].attempts).toBe(3)
  })

  it('"Sair mesmo assim": clear descarta o que não subiu', async () => {
    mockSend.mockResolvedValue({ kind: 'retry', network: true })
    const { result } = renderHook(() => useCourierSync('k1'))
    await act(async () => {
      await result.current.enqueue(op('op1'))
      await result.current.enqueue(op('op2'))
    })
    await act(async () => {
      await result.current.clear()
    })
    expect(result.current.ops).toHaveLength(0)
  })

  it('sem entregador logado não faz nada', async () => {
    const { result } = renderHook(() => useCourierSync(null))
    await act(async () => {
      await result.current.flush()
    })
    expect(mockSend).not.toHaveBeenCalled()
  })
})
