import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import ComboCard from '../../components/client/ComboCard'
import { AutoRechargeBanner } from '../../components/client/AutoRechargeBanner'

interface Combo {
  id: string
  name: string
  quantity: number
  price: number
  isActive: boolean
  tag?: string
  antes?: number
}

const PEDIDO_UNICO_ROUTE = '/client/agenda/pedido-unico'

export function CombosScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [combos, setCombos] = useState<Combo[]>([])
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix')
  const [isBuying, setIsBuying] = useState(false)

  // Compat: o antigo link ?tab=avulso (compra avulsa de crédito) agora leva ao Pedido único.
  useEffect(() => {
    if (searchParams.get('tab') === 'avulso') {
      navigate(PEDIDO_UNICO_ROUTE, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const combosRes = await apiFetch('/combos')
        if (combosRes.ok) {
          const data = (await combosRes.json()) as Combo[]
          setCombos(data)
          if (data.length > 0) setSelectedCombo(data[0])
        }
      } catch {
        setError('Não foi possível carregar os combos. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleComprar = async () => {
    if (isBuying || !selectedCombo) return
    setIsBuying(true)
    setError(null)
    try {
      if (paymentMethod === 'card') {
        navigate('/client/creditos/cartao', {
          state: { comboId: selectedCombo.id, amount: selectedCombo.price, quantity: selectedCombo.quantity },
        })
        return
      }

      const res = await apiFetch('/payments/pix', {
        method: 'POST',
        body: JSON.stringify({ comboId: selectedCombo.id }),
      })

      if (res.ok) {
        const { paymentId, pixCopyPaste, pixQrCodeUrl } = (await res.json()) as {
          paymentId: string
          pixCopyPaste: string
          pixQrCodeUrl: string
        }
        navigate('/client/creditos/pix', {
          state: { paymentId, pixQrCodeUrl, pixCopyPaste, comboQuantity: selectedCombo.quantity },
        })
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Algo deu errado. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsBuying(false)
    }
  }

  const ctaLabel = selectedCombo ? `Comprar ${selectedCombo.name}` : 'Selecione um combo'

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: '0 0 16px 0',
          }}
        >
          Créditos
        </h1>

        {/* Segmented Control — "Pedido único" leva à tela de agendamento avulso */}
        <div
          style={{
            display: 'flex',
            background: 'var(--color-surface-2)',
            borderRadius: 14,
            padding: 4,
            gap: 6,
            marginBottom: 20,
          }}
        >
          <button
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 11,
              border: 'none',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-soft)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--color-text)',
              cursor: 'default',
            }}
          >
            Combos
          </button>
          <button
            onClick={() => navigate(PEDIDO_UNICO_ROUTE)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 11,
              border: 'none',
              background: 'transparent',
              boxShadow: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--color-text-sec)',
              cursor: 'pointer',
              transition: 'background .15s, box-shadow .15s',
            }}
          >
            Pedido único
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, padding: '0 20px', paddingBottom: 116, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {error && (
          <p style={{ color: 'var(--color-accent)', fontSize: 14, marginBottom: 12 }}>
            {error}
          </p>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ height: 90, borderRadius: 22, background: 'var(--color-surface-2)' }}
              />
            ))}
          </div>
        ) : combos.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '40px 0',
            }}
          >
            <p style={{ color: 'var(--color-text-ter)', fontSize: 15, textAlign: 'center' }}>
              Nenhum combo disponível no momento.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {combos.map((combo) => (
              <ComboCard
                key={combo.id}
                combo={combo}
                selected={selectedCombo?.id === combo.id}
                onSelect={() => setSelectedCombo(combo)}
              />
            ))}
            {/* CRED-06: Créditos não expiram */}
            <div
              style={{
                background: 'var(--color-good-soft)',
                borderRadius: 12,
                padding: '10px 14px',
                marginTop: 4,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--color-good)',
                  margin: 0,
                }}
              >
                ✓ Créditos não expiram. Pause quando viajar.
              </p>
            </div>
          </div>
        )}

        {/* Compra automática — empurrada para o rodapé, com respiro acima da barra fixa */}
        <div style={{ marginTop: 'auto', paddingTop: 28, marginBottom: 10 }}>
          <AutoRechargeBanner />
        </div>
      </div>

      {/* Fixed CTA bar above tab bar */}
      {!isLoading && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(56px + env(safe-area-inset-bottom))',
            left: 0,
            right: 0,
            padding: '10px 20px 12px',
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Payment method toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['pix', 'card'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                style={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: 'var(--radius-btn)',
                  border:
                    paymentMethod === m
                      ? '1.5px solid var(--color-accent)'
                      : '1.5px solid var(--color-border)',
                  background: paymentMethod === m ? 'var(--color-surface)' : 'transparent',
                  color:
                    paymentMethod === m ? 'var(--color-accent)' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {m === 'pix' ? 'Pix' : 'Cartão'}
              </button>
            ))}
          </div>
          <button
            onClick={handleComprar}
            disabled={isBuying || !selectedCombo}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-espresso)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              cursor: isBuying || !selectedCombo ? 'default' : 'pointer',
              opacity: isBuying || !selectedCombo ? 0.7 : 1,
            }}
          >
            {isBuying ? 'Processando...' : ctaLabel}
          </button>
        </div>
      )}
    </div>
  )
}
