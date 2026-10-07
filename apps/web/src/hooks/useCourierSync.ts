import { useCallback, useEffect, useRef, useState } from 'react'
import { clearOps, enqueueOp, flushOps, listOps, type QueuedOp, type SendOutcome } from '../lib/courierQueue'
import { sendQueuedOp } from '../lib/courierApi'

/** Reenvio periódico com o app aberto — o iPhone não tem Background Sync (T-7). */
export const SYNC_INTERVAL_MS = 30_000

/**
 * Fila offline do entregador na tela: o que está guardado, se está enviando e se o último envio
 * parou por falta de sinal. Reenvia ao voltar o sinal (`online`), ao reabrir o app
 * (`visibilitychange`) e a cada 30 s.
 */
export function useCourierSync(courierId: string | null, onResult?: (op: QueuedOp, outcome: SendOutcome) => void) {
  const [ops, setOps] = useState<QueuedOp[]>([])
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const busyRef = useRef(false)
  const againRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const refresh = useCallback(async () => {
    if (!courierId) return []
    const list = await listOps(courierId)
    setOps(list)
    return list
  }, [courierId])

  /** Envia o que está guardado. Chamadas durante um envio viram uma nova rodada no fim. */
  const flush = useCallback(async () => {
    if (!courierId) return
    if (busyRef.current) {
      againRef.current = true
      return
    }
    busyRef.current = true
    try {
      do {
        againRef.current = false
        if ((await refresh()).length === 0) break
        setSending(true)
        const { offline: noSignal } = await flushOps(courierId, sendQueuedOp, (op, out) => {
          onResultRef.current?.(op, out)
          void refresh()
        })
        setOffline(noSignal)
        await refresh()
        if (noSignal) break
      } while (againRef.current)
    } finally {
      busyRef.current = false
      setSending(false)
    }
  }, [courierId, refresh])

  /** Guarda a operação e tenta enviar na hora. */
  const enqueue = useCallback(
    async (op: QueuedOp) => {
      await enqueueOp(op)
      await refresh()
      void flush()
    },
    [refresh, flush],
  )

  /** Descarta o que ainda não subiu (sair do app mesmo assim). */
  const clear = useCallback(async () => {
    if (!courierId) return
    await clearOps(courierId)
    await refresh()
  }, [courierId, refresh])

  useEffect(() => {
    if (!courierId) return
    void flush()
    const onOnline = () => {
      setOffline(false)
      void flush()
    }
    const onOffline = () => setOffline(true)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => void flush(), SYNC_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [courierId, flush])

  return { ops, sending, offline, enqueue, flush, clear }
}
