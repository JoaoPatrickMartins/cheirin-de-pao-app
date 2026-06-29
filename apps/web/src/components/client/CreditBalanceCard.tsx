import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { animate, motion } from 'framer-motion'
import { BreadMark } from '../brand/BreadMark'
import { Icon } from '../brand/Icon'

interface CreditBalanceCardProps {
  creditBalance: number
  isLoading?: boolean
  /** Estimativa de dias de duração calculada pelo ritmo real da agenda (HomeScreen).
   *  Ausente/0 → cai no fallback do protótipo (~saldo/4). */
  daysEstimate?: number
}

/** Decide uma única vez (na montagem) se devemos animar — respeita prefers-reduced-motion
 *  e ambientes sem matchMedia (jsdom/SSR), onde mostramos o valor final direto. */
function useShouldAnimate(): boolean {
  return useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
}

/** Conta de 0 até o saldo na entrada; em updates posteriores transiciona do valor anterior. */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  const prev = useRef(target)
  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return
    }
    const from = prev.current === target ? 0 : prev.current
    const controls = animate(from, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    prev.current = target
    return () => controls.stop()
  }, [target, enabled])
  return value
}

export function CreditBalanceCard({ creditBalance, isLoading = false, daysEstimate }: CreditBalanceCardProps) {
  const navigate = useNavigate()
  const shouldAnimate = useShouldAnimate()
  const displayed = useCountUp(creditBalance, shouldAnimate && !isLoading)

  // "Rende ~N dias": ritmo real da agenda quando disponível; senão, aproximação do protótipo.
  const days = daysEstimate && daysEstimate > 0 ? daysEstimate : Math.max(1, Math.floor(creditBalance / 4))

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        border: '1px solid var(--color-border-2)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      {/* Espresso section */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E1207, #2E1D0D)',
          padding: '22px 22px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Brilho diagonal de entrada */}
        {shouldAnimate && <span className="cdp-sheen" aria-hidden="true" />}

        {/* BreadMark watermark (flutua suavemente) */}
        <div
          className="cdp-float"
          style={{
            position: 'absolute',
            bottom: -50,
            right: -30,
            opacity: 0.1,
            pointerEvents: 'none',
          }}
        >
          <BreadMark size={200} color="#E3AC3F" />
        </div>

        <div style={{ position: 'relative' }}>
          {/* Label */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#C7B595',
              letterSpacing: '0.04em',
              margin: '0 0 6px',
              textTransform: 'uppercase' as const,
            }}
          >
            VOCÊ TEM
          </p>

          {/* Balance number */}
          {isLoading ? (
            <div
              style={{
                width: 120,
                height: 52,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.15)',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <span
                data-testid="credit-balance"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 52,
                  color: '#FAF5EC',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {displayed}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#E3AC3F',
                  lineHeight: 1,
                }}
              >
                pães
              </span>
            </div>
          )}

          {/* Subtexto ritmo */}
          {!isLoading && creditBalance > 0 && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                color: '#9A876B',
                margin: '8px 0 0',
              }}
            >
              Rende ~{days} dias no seu ritmo atual
            </p>
          )}

          {!isLoading && creditBalance === 0 && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                color: '#9A876B',
                margin: '8px 0 0',
              }}
            >
              Compre pães para começar
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: 'var(--color-surface)',
          padding: '12px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        {/* Comprar créditos — gold button, flex: 1 */}
        <motion.button
          onClick={() => navigate('/client/creditos')}
          whileHover={{ y: -1, filter: 'brightness(1.05)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '13px 18px',
            letterSpacing: '-0.01em',
          }}
        >
          <Icon name="plus" size={18} stroke={2.4} color="var(--color-espresso)" />
          Comprar pães
        </motion.button>

        {/* Extrato — soft button, flexShrink: 0 */}
        <motion.button
          onClick={() => navigate('/client/creditos/extrato')}
          whileHover={{ y: -1, filter: 'brightness(1.03)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            flexShrink: 0,
            minHeight: 44,
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '13px 18px',
            letterSpacing: '-0.01em',
          }}
        >
          <Icon name="clock" size={18} stroke={2.2} color="var(--color-text)" />
          Extrato
        </motion.button>
      </div>
    </div>
  )
}
