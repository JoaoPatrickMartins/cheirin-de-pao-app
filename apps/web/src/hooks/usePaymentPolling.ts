import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

interface PollingOptions {
  /** Nº máximo de tentativas antes de desistir (isTimeout). Default 5. */
  maxAttempts?: number
  /** Intervalo entre tentativas em ms. Default 3000. */
  intervalMs?: number
}

export function usePaymentPolling(
  paymentId: string | null,
  onApproved: (creditBalance: number) => void,
  onRejected?: () => void,
  options?: PollingOptions,
): { isTimeout: boolean; attempts: number } {
  const [attempts, setAttempts] = useState(0)
  const maxAttempts = options?.maxAttempts ?? 5
  const intervalMs = options?.intervalMs ?? 3000

  useEffect(() => {
    if (!paymentId || attempts >= maxAttempts) return

    const id = setInterval(async () => {
      try {
        const res = await apiFetch(`/payments/${paymentId}/status`)
        const data = (await res.json()) as { status: string; creditBalance?: number }
        if (data.status === 'approved') {
          clearInterval(id)
          onApproved(data.creditBalance ?? 0)
        } else if (data.status === 'rejected') {
          clearInterval(id)
          onRejected?.()
        } else {
          setAttempts((a) => a + 1)
        }
      } catch {
        setAttempts((a) => a + 1)
      }
    }, intervalMs)

    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, attempts])

  return { isTimeout: attempts >= maxAttempts, attempts }
}
