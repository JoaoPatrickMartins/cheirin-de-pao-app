import { useNavigate } from 'react-router'
import { BreadMark } from '../brand/BreadMark'

interface CreditBalanceCardProps {
  creditBalance: number
  isLoading?: boolean
}

export function CreditBalanceCard({ creditBalance, isLoading = false }: CreditBalanceCardProps) {
  const navigate = useNavigate()

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
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
        {/* BreadMark watermark */}
        <div
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

        {/* Label */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: '#C7B595',
            letterSpacing: '0.04em',
            margin: '0 0 8px',
            textTransform: 'uppercase' as const,
          }}
        >
          SEUS CRÉDITOS
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
              }}
            >
              {creditBalance}
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
            Rende ~{Math.floor(creditBalance)} dias no seu ritmo atual
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
            Adicione créditos para começar
          </p>
        )}
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
        <button
          onClick={() => navigate('/client/creditos')}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'var(--color-espresso)',
            color: '#FAF5EC',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '13px 18px',
            transition: 'transform 0.15s, filter 0.15s',
          }}
        >
          Comprar créditos
        </button>

        {/* Extrato — soft button, flexShrink: 0 */}
        <button
          onClick={() => navigate('/client/creditos/extrato')}
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
            gap: 6,
            padding: '13px 18px',
            transition: 'transform 0.15s, filter 0.15s',
          }}
        >
          Extrato
        </button>
      </div>
    </div>
  )
}
