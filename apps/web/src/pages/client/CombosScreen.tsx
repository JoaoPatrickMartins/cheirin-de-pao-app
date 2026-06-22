import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import ComboCard from '../../components/client/ComboCard'
import QuantityStepper from '../../components/client/QuantityStepper'
import BannerInsuficiente from '../../components/client/BannerInsuficiente'
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

interface Pricing {
  avulsoLimite: number
  avulsoUnit: number
}

const formatBRL = (val: number | undefined | null) =>
  (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CombosScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [tab, setTab] = useState<'combos' | 'avulso'>(
    searchParams.get('tab') === 'avulso' ? 'avulso' : 'combos',
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [combos, setCombos] = useState<Combo[]>([])
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null)
  const [customQty, setCustomQty] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix')
  const [isBuying, setIsBuying] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [combosRes, pricingRes] = await Promise.all([
          apiFetch('/combos'),
          apiFetch('/pricing'),
        ])
        if (combosRes.ok) {
          const data = (await combosRes.json()) as Combo[]
          setCombos(data)
          if (data.length > 0) setSelectedCombo(data[0])
        }
        if (pricingRes.ok) {
          const data = (await pricingRes.json()) as Pricing
          setPricing(data)
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
    if (isBuying) return
    setIsBuying(true)
    setError(null)
    try {
      if (paymentMethod === 'card') {
        const isCombo = tab === 'combos' && selectedCombo
        const amount = isCombo ? selectedCombo.price : (pricing?.avulsoUnit ?? 0) * customQty
        const quantity = isCombo ? selectedCombo.quantity : customQty
        navigate('/client/creditos/cartao', {
          state: { comboId: selectedCombo?.id, customQuantity: isCombo ? undefined : customQty, amount, quantity },
        })
        return
      }

      const body =
        tab === 'combos' && selectedCombo
          ? { comboId: selectedCombo.id }
          : { customQuantity: customQty }

      const res = await apiFetch('/payments/pix', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const { paymentId, pixCopyPaste, pixQrCodeUrl } =
          (await res.json()) as {
            paymentId: string
            pixCopyPaste: string
            pixQrCodeUrl: string
          }
        const comboQuantity = selectedCombo?.quantity ?? customQty
        navigate('/client/creditos/pix', {
          state: { paymentId, pixQrCodeUrl, pixCopyPaste, comboQuantity },
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

  const creditBalance = user?.creditBalance ?? 0
  const requiredCredits =
    tab === 'combos' ? (selectedCombo?.quantity ?? 0) : customQty

  const bestComboUnit =
    combos.length > 0 ? Math.min(...combos.map((c) => c.price / c.quantity)) : null
  const avulsoUnit = pricing?.avulsoUnit ?? 0
  const economia =
    bestComboUnit !== null && avulsoUnit > bestComboUnit
      ? Math.round(((avulsoUnit - bestComboUnit) / avulsoUnit) * 100)
      : 0

  const ctaLabel =
    tab === 'combos'
      ? selectedCombo
        ? `Comprar ${selectedCombo.name}`
        : 'Selecione um combo'
      : `Comprar ${customQty} ${customQty === 1 ? 'pão' : 'pães'}`

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

        {/* Segmented Control — gap 6px conforme UI-SPEC.md §Exceções de Espaçamento */}
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
          {(['combos', 'avulso'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 11,
                border: 'none',
                background: tab === t ? 'var(--color-surface)' : 'transparent',
                boxShadow: tab === t ? 'var(--shadow-soft)' : 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 14,
                color: tab === t ? 'var(--color-text)' : 'var(--color-text-sec)',
                cursor: 'pointer',
                transition: 'background .15s, box-shadow .15s',
              }}
            >
              {t === 'combos' ? 'Combos' : 'Avulso'}
            </button>
          ))}
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
        ) : tab === 'combos' ? (
          combos.length === 0 ? (
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
              {creditBalance < requiredCredits && requiredCredits > 0 && (
                <BannerInsuficiente
                  saldo={creditBalance}
                  requerido={requiredCredits}
                  onComprar={() => setTab('combos')}
                  onAjustar={(qtd) => setCustomQty(qtd)}
                />
              )}
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
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* BannerInsuficiente aba avulso — quando customQty > creditBalance */}
            {creditBalance < customQty && (
              <BannerInsuficiente
                saldo={creditBalance}
                requerido={customQty}
                onComprar={() => setTab('combos')}
                onAjustar={(qtd) => setCustomQty(qtd)}
              />
            )}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 12.5,
                letterSpacing: '0.04em',
                color: 'var(--color-text-sec)',
                margin: 0,
              }}
            >
              QUANTOS PÃES?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <QuantityStepper
                min={1}
                max={pricing ? pricing.avulsoLimite - 1 : 29}
                value={customQty}
                onChange={setCustomQty}
              />
            </div>
            {pricing && (
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--color-text-sec)',
                    margin: 0,
                  }}
                >
                  {formatBRL(pricing.avulsoUnit)} por pão
                </p>
                {economia > 0 && (
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      color: 'var(--color-accent)',
                      margin: '4px 0 0 0',
                      fontWeight: 600,
                    }}
                  >
                    {economia}% mais barato por pão nos combos
                  </p>
                )}
              </div>
            )}
            {/* CRED-06 */}
            <div
              style={{
                background: 'var(--color-good-soft)',
                borderRadius: 12,
                padding: '10px 14px',
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
            disabled={isBuying || (tab === 'combos' && !selectedCombo)}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-accent)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              cursor:
                isBuying || (tab === 'combos' && !selectedCombo) ? 'default' : 'pointer',
              opacity: isBuying || (tab === 'combos' && !selectedCombo) ? 0.7 : 1,
            }}
          >
            {isBuying ? 'Processando...' : ctaLabel}
          </button>
        </div>
      )}
    </div>
  )
}
