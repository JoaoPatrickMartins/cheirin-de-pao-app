import { useState, useEffect } from 'react'

interface ResendTimerProps {
  onResend: () => void
}

const RESEND_SECONDS = 30

/**
 * 30-second countdown timer for OTP resend.
 * Shows "Não chegou? Reenviar em M:SS" during countdown (color-text-ter).
 * Shows "Não chegou? Reenviar código" as clickable link when timer expires (color-accent).
 */
export function ResendTimer({ onResend }: ResendTimerProps) {
  const [seconds, setSeconds] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  const handleResend = () => {
    if (seconds > 0) return
    setSeconds(RESEND_SECONDS)
    onResend()
  }

  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, '0')
  const isActive = seconds <= 0

  return (
    <div
      style={{
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        color: 'var(--color-text-ter)',
      }}
    >
      Não chegou?{' '}
      <button
        type="button"
        onClick={handleResend}
        disabled={!isActive}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 12,
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          color: isActive ? 'var(--color-accent)' : 'var(--color-text-ter)',
          cursor: isActive ? 'pointer' : 'default',
        }}
      >
        {isActive ? 'Reenviar código' : `Reenviar em ${mm}:${ss}`}
      </button>
    </div>
  )
}
