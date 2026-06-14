// usePaymentPolling hook tests -- Wave 0 stubs (RED state)
// Requirements: cleanup clearInterval (sem memory leak), MAX_ATTEMPTS = 5
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ status: 'pending' }),
  }),
}))

// import { usePaymentPolling } from '../usePaymentPolling'

describe('usePaymentPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('cleanup sem memory leak', () => {
    it('TODO: chama clearInterval quando o componente e desmontado (cleanup)', () => { expect(true).toBe(false) })
    it('TODO: nao faz mais chamadas apos o componente ser desmontado', () => { expect(true).toBe(false) })
  })

  describe('MAX_ATTEMPTS = 5', () => {
    it('TODO: para de fazer polling apos 5 tentativas (isTimeout = true)', () => { expect(true).toBe(false) })
    it('TODO: faz exatamente MAX_ATTEMPTS = 5 chamadas antes de parar', () => { expect(true).toBe(false) })
    it('TODO: para de fazer polling imediatamente quando status e approved', () => { expect(true).toBe(false) })
  })
})
