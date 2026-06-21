import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { SavedCardsList } from '../../components/client/SavedCardsList'
import { AddCardForm } from '../../components/client/AddCardForm'
import type { SavedCard } from '../../components/client/SavedCardItem'

const CARD_LIMIT = 3

export function CardsScreen() {
  const navigate = useNavigate()

  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [cardError, setCardError] = useState<string | null>(null)

  // Set default / remove
  const [removingCardId, setRemovingCardId] = useState<string | null>(null)
  const [cardToRemove, setCardToRemove] = useState<SavedCard | null>(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  const [adding, setAdding] = useState(false)

  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)
  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    apiFetch('/users/me/cards')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((cards: SavedCard[]) => setSavedCards(cards))
      .catch(() => setCardError('Não foi possível carregar seus cartões. Tente novamente.'))
      .finally(() => setLoadingCards(false))
  }, [])

  const handleSetDefault = async (cardId: string) => {
    try {
      const res = await apiFetch(`/users/me/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        setSavedCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === cardId })))
        showToast('Cartão padrão atualizado.', true)
      } else {
        showToast('Algo deu errado. Tente novamente.', false)
      }
    } catch {
      showToast('Algo deu errado. Tente novamente.', false)
    }
  }

  const handleRemovePress = (card: SavedCard) => {
    setCardToRemove(card)
    setShowRemoveDialog(true)
  }

  const handleRemoveConfirm = async () => {
    if (!cardToRemove) return
    setRemovingCardId(cardToRemove.id)
    try {
      const res = await apiFetch(`/users/me/cards/${cardToRemove.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setSavedCards((prev) => prev.filter((c) => c.id !== cardToRemove.id))
        showToast('Cartão removido.', true)
        setShowRemoveDialog(false)
        setCardToRemove(null)
      } else {
        showToast('Algo deu errado. Tente novamente.', false)
      }
    } catch {
      showToast('Algo deu errado. Tente novamente.', false)
    } finally {
      setRemovingCardId(null)
    }
  }

  // Salva o cartão (sem cobrança). Retorna mensagem de erro ou null em sucesso.
  const handleAddCard = async (paymentMethodId: string): Promise<string | null> => {
    try {
      const res = await apiFetch('/users/me/cards', {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId }),
      })
      if (res.ok) {
        const card = (await res.json()) as SavedCard
        setSavedCards((prev) => [...prev, card])
        setAdding(false)
        showToast('Cartão salvo!', true)
        return null
      }
      const err = (await res.json()) as { error?: string }
      return err.error ?? 'Não foi possível salvar o cartão. Tente novamente.'
    } catch {
      return 'Algo deu errado. Verifique sua conexão e tente novamente.'
    }
  }

  const atLimit = savedCards.length >= CARD_LIMIT
  const canAdd = !loadingCards && !cardError && !atLimit

  return (
    <div
      style={{
        minHeight: '100dvh',
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
            color: 'var(--color-primary-btn-text)',
            borderRadius: 12,
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* AppBar */}
      <div
        style={{
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          padding: '6px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => (adding ? setAdding(false) : navigate('/client/perfil'))}
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
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {adding ? 'Adicionar cartão' : 'Meus cartões'}
        </h1>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 80 }}>
        {adding ? (
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              padding: 20,
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <AddCardForm
              submitLabel="Salvar cartão"
              note="Dados do cartão protegidos pelo Mercado Pago. Nenhuma cobrança é feita ao salvar."
              onSubmit={handleAddCard}
            />
          </div>
        ) : (
          <>
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-card)',
                padding: 24,
                boxShadow: 'var(--shadow-soft)',
                marginBottom: 16,
              }}
            >
              <SavedCardsList
                cards={savedCards}
                loading={loadingCards}
                error={cardError}
                mode="manage"
                onSetDefault={handleSetDefault}
                onRemove={(id) => handleRemovePress(savedCards.find((c) => c.id === id)!)}
                removingId={removingCardId}
              />
            </div>

            {canAdd && (
              <button
                onClick={() => setAdding(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  height: 52,
                  background: 'var(--color-espresso)',
                  color: 'var(--color-primary-btn-text)',
                  borderRadius: 'var(--radius-btn)',
                  border: 'none',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Icon name="plus" size={20} color="var(--color-primary-btn-text)" />
                Adicionar cartão
              </button>
            )}

            {atLimit && !loadingCards && !cardError && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  color: 'var(--color-text-ter)',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                Você atingiu o limite de {CARD_LIMIT} cartões salvos.
              </p>
            )}
          </>
        )}
      </div>

      {/* Dialog: confirmar remoção de cartão */}
      {showRemoveDialog && cardToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowRemoveDialog(false)
            setCardToRemove(null)
            setRemovingCardId(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 22,
              padding: 24,
              width: 'calc(100vw - 48px)',
              maxWidth: 320,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 8px',
              }}
            >
              Remover cartão
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--color-text-sec)',
                margin: '0 0 20px',
                lineHeight: 1.5,
              }}
            >
              Tem certeza que deseja remover o cartão •••• {cardToRemove.lastFour}? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  setShowRemoveDialog(false)
                  setCardToRemove(null)
                }}
                style={{
                  width: '100%',
                  height: 52,
                  background: 'transparent',
                  color: 'var(--color-text)',
                  borderRadius: 'var(--radius-btn)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  border: '1.5px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                Manter cartão
              </button>
              <button
                onClick={() => void handleRemoveConfirm()}
                disabled={removingCardId !== null}
                style={{
                  width: '100%',
                  height: 52,
                  background: '#C0392B',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-btn)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: removingCardId !== null ? 'not-allowed' : 'pointer',
                  opacity: removingCardId !== null ? 0.7 : 1,
                }}
              >
                {removingCardId !== null ? 'Removendo...' : 'Remover cartão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
