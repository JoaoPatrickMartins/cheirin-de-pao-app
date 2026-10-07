import { useEffect, useRef, useState } from 'react'

type Sentinel = { release: () => Promise<void>; addEventListener?: (t: 'release', cb: () => void) => void }

/**
 * Tela sempre acesa durante a rota (M-10). Pede o `screen` wake lock e pede de novo ao voltar para
 * o app (o navegador solta o lock quando a aba some). Sem suporte (iPhone antigo), não faz nada.
 */
export function useWakeLock(active: boolean): { supported: boolean; locked: boolean } {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [locked, setLocked] = useState(false)
  const sentinel = useRef<Sentinel | null>(null)

  useEffect(() => {
    if (!active || !supported) return
    let cancelled = false
    const acquire = async () => {
      try {
        const s = (await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock.request('screen')) as Sentinel
        if (cancelled) {
          void s.release()
          return
        }
        sentinel.current = s
        setLocked(true)
        s.addEventListener?.('release', () => setLocked(false))
      } catch {
        setLocked(false)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel.current?.release().catch(() => {})
      sentinel.current = null
      setLocked(false)
    }
  }, [active, supported])

  return { supported, locked }
}
