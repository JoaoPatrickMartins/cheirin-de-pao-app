import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { SavedCardsList } from '../../components/client/SavedCardsList'
import { AddCardForm } from '../../components/client/AddCardForm'
import type { SavedCard } from '../../components/client/SavedCardItem'

interface CardState {
  comboId?: string
  customQuantity?: number
  amount: number
  quantity?: number
}

export function CardPaymentScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as CardState | null) ?? { amount: 0 }
  const { comboId, customQuantity } = state

  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [addCardExpanded, setAddCardExpanded] = useState(false)

  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  const loadCards = async () => {
    try {
      const res = await apiFetch('/users/me/cards')
      if (res.ok) {
        const cards = (await res.json()) as SavedCard[]
        setSavedCards(cards)
        const toSelect = cards.find((c) => c.isDefault) ?? cards[0]
        if (toSelect) setSelectedCardId(toSelect.id)
        return cards
      }
    } catch {
      // Falha silenciosa — cai no fluxo de adicionar cartão
    }
    return [] as SavedCard[]
  }

  useEffect(() => {
    void loadCards().finally(() => setLoadingCards(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasSavedCards = savedCards.length > 0
  const goToSuccess = () =>
    navigate('/client/creditos/sucesso', { state: { quantity: state.quantity ?? customQuantity ?? 1 } })

  // Cobra um cartão salvo SEM CVV (off_session / 1 toque)
  const payWithSavedCard = async (savedCardId: string): Promise<string | null> => {
    const res = await apiFetch('/payments/card', {
      method: 'POST',
      body: JSON.stringify({ savedCardId, comboId, customQuantity }),
    })
    if (res.ok) {
      goToSuccess()
      return null
    }
    const err = (await res.json()) as { error?: string }
    return err.error ?? 'Não foi possível concluir o pagamento. Tente outro cartão.'
  }

  const handlePayWithSavedCard = async () => {
    if (isProcessing || !selectedCardId) return
    setIsProcessing(true)
    try {
      const msg = await payWithSavedCard(selectedCardId)
      if (msg) showToast(msg)
    } catch {
      showToast('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Cartão novo: salva (SetupIntent já confirmado → paymentMethodId) e paga em seguida (off_session)
  const handleAddAndPay = async (paymentMethodId: string): Promise<string | null> => {
    try {
      const saveRes = await apiFetch('/users/me/cards', {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId }),
      })
      if (!saveRes.ok) {
        const err = (await saveRes.json()) as { error?: string }
        return err.error ?? 'Não foi possível salvar o cartão.'
      }
      const card = (await saveRes.json()) as SavedCard
      return await payWithSavedCard(card.id)
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
            maxWidth: '90vw',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ flex: 1, padding: '20px', paddingBottom: showSavedCardCta ? 116 : 24, overflowY: 'auto' }}>
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
          Pagamento processado com segurança pelo Stripe
        </p>

        {loadingCards && <SavedCardsList cards={[]} loading mode="select" />}

        {/* ── Cliente tem cartões salvos: 1 toque, sem CVV ── */}
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
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-2)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)' }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-2)' }} />
            </div>

            <div
              role={addCardExpanded ? undefined : 'button'}
              aria-expanded={addCardExpanded}
              tabIndex={addCardExpanded ? undefined : 0}
              onClick={() => {
                if (!addCardExpanded) {
                  setAddCardExpanded(true)
                  setSelectedCardId(null)
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !addCardExpanded) {
                  setAddCardExpanded(true)
                  setSelectedCardId(null)
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
                  <AddCardForm submitLabel="Salvar cartão e pagar" onSubmit={handleAddAndPay} />
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
            <AddCardForm
              submitLabel="Salvar cartão e pagar"
              onSubmit={handleAddAndPay}
              note="Seu cartão é salvo com segurança para as próximas compras serem em 1 toque, sem CVV."
            />
          </div>
        )}
      </div>

      {/* CTA fixa — pagar com cartão salvo selecionado, em 1 toque sem CVV */}
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
              background: 'var(--color-espresso)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              cursor: isProcessing ? 'default' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing ? 'Processando…' : 'Pagar com 1 toque (sem CVV)'}
          </button>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
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
    </p>
  )
}
