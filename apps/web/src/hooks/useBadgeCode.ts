import { useEffect, useState } from 'react'
import { badgeCryptoAvailable, badgeToken, badgeWindow, type BadgeToken } from '@cheirin-de-pao/shared'

/**
 * Crachá v3 (Onda 11 · T-25/T-26): relógio corrigido pela hora do servidor, janela de 30 s e o
 * QR/código da janela, gerados no aparelho (sem rede). `unavailable` = o navegador não tem Web
 * Crypto (página fora de HTTPS — T-32).
 */
export function useBadgeCode({ secret, courierId, offsetMs, enabled }: { secret: string | null; courierId: string | null; offsetMs: number; enabled: boolean }): {
  now: Date
  token: BadgeToken | null
  secondsLeft: number
  unavailable: boolean
} {
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  const [token, setToken] = useState<BadgeToken | null>(null)
  const unavailable = enabled && !!secret && !badgeCryptoAvailable()

  useEffect(() => {
    setNow(Date.now() + offsetMs)
    const t = setInterval(() => setNow(Date.now() + offsetMs), 1000)
    return () => clearInterval(t)
  }, [offsetMs])

  const { window, secondsLeft } = badgeWindow(now)
  useEffect(() => {
    if (!enabled || !secret || !courierId || !badgeCryptoAvailable()) {
      setToken(null)
      return
    }
    let alive = true
    void badgeToken(secret, courierId, window)
      .then((t) => alive && setToken(t))
      .catch(() => alive && setToken(null))
    return () => {
      alive = false
    }
  }, [enabled, secret, courierId, window])

  return { now: new Date(now), token, secondsLeft, unavailable }
}
