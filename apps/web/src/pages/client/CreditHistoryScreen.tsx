import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'

interface CreditTransaction {
  id: string
  type: string
  quantity: number // com sinal: positivo = entrada, negativo = saída
  description?: string | null
  createdAt: string
}

// Rótulo amigável por tipo, usado quando a transação não tem `description`
const TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'Compra de créditos',
  DELIVERY: 'Entrega',
  ADMIN_GRANT: 'Crédito concedido',
  DELIVERY_DONE: 'Entrega realizada',
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
              marginTop: 56,
              padding: '0 24px',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--color-surface-2)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="coin" size={26} color="var(--color-accent)" />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Nada por aqui ainda
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text-sec)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Suas compras e entregas de créditos vão aparecer aqui assim que rolar a primeira. 🥖
            </p>
          </div>
        )}

        {!isLoading && !error && transactions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.map((tx) => {
              const isCredit = tx.quantity >= 0
              return (
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
                      background: isCredit ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        transform: isCredit ? undefined : 'rotate(180deg)',
                      }}
                    >
                      <Icon
                        name="arrowU"
                        size={18}
                        color={isCredit ? 'var(--color-gold)' : 'var(--color-accent)'}
                        stroke={2.2}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                      }}
                    >
                      {tx.description || TYPE_LABEL[tx.type] || 'Movimentação'}
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
                      color: isCredit ? 'var(--color-gold)' : 'var(--color-accent)',
                      letterSpacing: '-0.02em',
                      flexShrink: 0,
                    }}
                  >
                    {`${isCredit ? '+' : '−'}${Math.abs(tx.quantity)}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
