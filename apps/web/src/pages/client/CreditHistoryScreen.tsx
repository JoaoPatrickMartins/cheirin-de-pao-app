import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'

interface CreditTransaction {
  id: string
  type: 'PURCHASE' | 'CONSUMPTION'
  quantity: number
  createdAt: string
}

export function CreditHistoryScreen() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const fetchHistory = async () => {
      try {
        const res = await apiFetch('/credits/history')
        if (res.ok) {
          const data = (await res.json()) as CreditTransaction[]
          setTransactions(data)
        } else {
          setError('Não foi possível carregar o extrato.')
        }
      } catch {
        setError('Erro de conexão. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    }
    void fetchHistory()
  }, [token])

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('pt-BR').format(new Date(dateStr))

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 20px 14px',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--color-surface-2)',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Extrato de créditos
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px 20px' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: 64,
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-surface-2)',
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-accent)',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {!isLoading && !error && transactions.length === 0 && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text-ter)',
              textAlign: 'center',
              marginTop: 40,
            }}
          >
            Nenhuma transação ainda.
          </p>
        )}

        {!isLoading && !error && transactions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: tx.type === 'PURCHASE' ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name={tx.type === 'PURCHASE' ? 'arrowU' : 'chevD'}
                    size={18}
                    color={tx.type === 'PURCHASE' ? 'var(--color-gold)' : 'var(--color-accent)'}
                    stroke={2.2}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                    }}
                  >
                    {tx.type === 'PURCHASE' ? 'Compra de créditos' : 'Entrega'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--color-text-ter)',
                      marginTop: 2,
                    }}
                  >
                    {formatDate(tx.createdAt)}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16,
                    color: tx.type === 'PURCHASE' ? 'var(--color-gold)' : 'var(--color-accent)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {tx.type === 'PURCHASE' ? `+${tx.quantity}` : `-${tx.quantity}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
