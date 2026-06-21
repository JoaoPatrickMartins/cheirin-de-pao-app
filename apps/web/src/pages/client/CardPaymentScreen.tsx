import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { SavedCardsList } from '../../components/client/SavedCardsList'
import { AddCardForm } from '../../components/client/AddCardForm'
import type { AddCardPayload } from '../../components/client/AddCardForm'
import type { SavedCard } from '../../components/client/SavedCardItem'

interface CardState {
  comboId?: string
  customQuantity?: number
  amount: number
}

export function CardPaymentScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const state = (location.state as CardState | null) ?? { amount: 0 }
  const { comboId, customQuantity } = state

  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [addCardExpanded, setAddCardExpanded] = useState(false)
  const [cvv, setCvv] = useState('')
  const [cvvError, setCvvError] = useState<string | null>(null)

  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    const loadCards = async () => {
      try {
        const res = await apiFetch('/users/me/cards')
        if (res.ok) {
          const cards = (await res.json()) as SavedCard[]
          setSavedCards(cards)
          const toSelect = cards.find((c) => c.isDefault) ?? cards[0]
          if (toSelect) setSelectedCardId(toSelect.id)
        }
      } catch {
        // Falha silenciosa — cai no fluxo de adicionar cartão
      } finally {
        setLoadingCards(false)
      }
    }
    void loadCards()
  }, [])

  const hasSavedCards = savedCards.length > 0
  const goToSuccess = () => navigate('/client/creditos/sucesso', { state: { quantity: customQuantity ?? 1 } })

  // Pagamento com cartão salvo (CVV por transação)
  const handlePayWithSavedCard = async () => {
    if (isProcessing || !selectedCardId) return
    const selectedCard = savedCards.find((c) => c.id === selectedCardId)
    const requiredCvvLength = selectedCard?.brand === 'amex' ? 4 : 3
    if (cvv.length < requiredCvvLength) {
      setCvvError(`Informe o código de segurança (${requiredCvvLength} dígitos)`)
      return
    }

    setIsProcessing(true)
    const cvvToSend = cvv
    setCvv('') // limpar CVV imediatamente após disparar o POST

    try {
      const res = await apiFetch('/payments/card', {
        method: 'POST',
        body: JSON.stringify({ savedCardId: selectedCardId, securityCode: cvvToSend, comboId, customQuantity }),
      })
      if (res.ok) {
        goToSuccess()
      } else {
        const err = (await res.json()) as { error?: string }
        showToast(err.error ?? 'Erro no pagamento. Verifique os dados e tente novamente.')
      }
    } catch {
      showToast('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Pagamento com cartão NOVO — sempre salva o cartão (saveCard: true). À vista (1x).
  const handlePayWithNewCard = async (payload: AddCardPayload): Promise<string | null> => {
    try {
      const res = await apiFetch('/payments/card', {
        method: 'POST',
        body: JSON.stringify({
          token: payload.token,
          installments: 1,
          paymentMethodId: payload.paymentMethodId ?? undefined,
          issuerId: payload.issuerId ?? undefined,
          payerEmail: user?.email,
          payerIdentification: payload.payerIdentification,
          saveCard: true,
          comboId,
          customQuantity,
        }),
      })
      if (res.ok) {
        goToSuccess()
        return null
      }
      const err = (await res.json()) as { error?: string }
      return err.error ?? 'Erro no pagamento. Verifique os dados e tente novamente.'
    } catch {
      return 'Algo deu errado. Verifique sua conexão e tente novamente.'
    }
  }

  const showSavedCardCta = hasSavedCards && selectedCardId !== null && !addCardExpanded

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--color-espresso)',
            color: '#FBF3E4',
            borderRadius: 12,
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 15,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Scroll area */}
      <div style={{ flex: 1, padding: '20px', paddingBottom: showSavedCardCta ? 116 : 24, overflowY: 'auto' }}>
        {/* AppBar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate('/client/creditos')}
            aria-label="Voltar"
            style={{
              minHeight: 44,
              width: 38,
              height: 38,
              borderRadius: 12,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="arrowL" size={20} color="var(--color-text)" />
          </button>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 21,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Pagamento com cartão
          </h1>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '0 0 24px' }}>
          Pagamento processado com segurança pelo Mercado Pago
        </p>

        {loadingCards && <SavedCardsList cards={[]} loading mode="select" />}

        {/* ── Cliente tem cartões salvos ── */}
        {!loadingCards && hasSavedCards && (
          <>
            <SectionLabel>SEUS CARTÕES</SectionLabel>
            <SavedCardsList
              cards={savedCards}
              loading={false}
              mode="select"
              selectedCardId={selectedCardId}
              onSelect={(id) => {
                setSelectedCardId(id)
                setAddCardExpanded(false)
                setCvvError(null)
              }}
            />

            {/* CVV do cartão salvo selecionado */}
            {selectedCardId !== null && !addCardExpanded && (
              <div style={{ marginTop: 16 }}>
                <SectionLabel as="p">Código de segurança (CVV)</SectionLabel>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={cvv}
                  placeholder="•••"
                  onChange={(e) => {
                    setCvv(e.target.value.replace(/\D/g, ''))
                    if (cvvError) setCvvError(null)
                  }}
                  style={{
                    width: 100,
                    border: cvvError ? '1.5px solid #C0392B' : '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-field)',
                    padding: '12px 14px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--color-text)',
                    background: 'var(--color-surface)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {cvvError && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: '#C0392B', margin: '6px 0 0' }}>
                    {cvvError}
                  </p>
                )}
              </div>
            )}

            {/* Separador "ou" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-2)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)' }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-2)' }} />
            </div>

            {/* Adicionar novo cartão (colapsável) */}
            <div
              role={addCardExpanded ? undefined : 'button'}
              aria-expanded={addCardExpanded}
              tabIndex={addCardExpanded ? undefined : 0}
              onClick={() => {
                if (!addCardExpanded) {
                  setAddCardExpanded(true)
                  setSelectedCardId(null)
                  setCvv('')
                  setCvvError(null)
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !addCardExpanded) {
                  setAddCardExpanded(true)
                  setSelectedCardId(null)
                  setCvv('')
                  setCvvError(null)
                }
              }}
              style={{
                borderRadius: 22,
                background: 'var(--color-surface)',
                border: addCardExpanded ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                boxShadow: 'var(--shadow-soft)',
                overflow: 'hidden',
                cursor: addCardExpanded ? 'default' : 'pointer',
                transition: 'border 150ms ease-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                <Icon name="plus" size={24} color="var(--color-accent)" />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text)' }}>
                  Adicionar novo cartão
                </span>
              </div>

              {addCardExpanded && (
                <div style={{ padding: '0 16px 16px' }}>
                  <AddCardForm submitLabel="Salvar cartão e pagar" onSubmit={handlePayWithNewCard} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Sem cartões salvos — adicionar e pagar ── */}
        {!loadingCards && !hasSavedCards && (
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              padding: 20,
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <AddCardForm submitLabel="Adicionar cartão e pagar" onSubmit={handlePayWithNewCard} />
          </div>
        )}
      </div>

      {/* CTA fixa — apenas para pagar com cartão salvo selecionado */}
      {showSavedCardCta && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(56px + env(safe-area-inset-bottom))',
            left: 0,
            right: 0,
            padding: '10px 20px 12px',
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
          }}
        >
          <button
            onClick={() => void handlePayWithSavedCard()}
            disabled={isProcessing}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-accent)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              cursor: isProcessing ? 'default' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing ? 'Processando...' : 'Pagar com este cartão'}
          </button>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children, as = 'p' }: { children: React.ReactNode; as?: 'p' }) {
  const Tag = as
  return (
    <Tag
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: 'var(--color-text-sec)',
        margin: '0 0 12px',
      }}
    >
      {children}
    </Tag>
  )
}
