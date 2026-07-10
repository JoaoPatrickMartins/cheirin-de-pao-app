import { SavedCardItem } from './SavedCardItem'
import type { SavedCard } from './SavedCardItem'

interface SavedCardsListProps {
  cards: SavedCard[]
  loading: boolean
  error?: string | null
  mode: 'select' | 'manage'
  selectedCardId?: string | null
  onSelect?: (id: string) => void
  onSetDefault?: (id: string) => void
  onRemove?: (id: string) => void
  removingId?: string | null
}

export function SavedCardsList({
  cards,
  loading,
  error,
  mode,
  selectedCardId,
  onSelect,
  onSetDefault,
  onRemove,
  removingId,
}: SavedCardsListProps) {
  // Estado de loading: 3 skeleton cards
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  // Estado de erro
  if (error) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          color: 'var(--color-text-sec)',
          textAlign: 'center',
          margin: 0,
          padding: '16px 0',
        }}
      >
        {error}
      </p>
    )
  }

  // Estado vazio — apenas exibido no modo 'manage'
  if (cards.length === 0) {
    if (mode === 'manage') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-ter)',
              margin: '0 0 4px',
            }}
          >
            Nenhum cartão salvo.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-text-ter)',
              margin: 0,
            }}
          >
            Você pode salvar um cartão ao fazer uma compra.
          </p>
        </div>
      )
    }
    // modo 'select' vazio: não exibe lista
    // (CardPaymentScreen controla o Modo B neste caso)
    return null
  }

  // Lista normal
  return (
    <div
      role={mode === 'select' ? 'radiogroup' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {cards.map((card) => (
        <SavedCardItem
          key={card.id}
          card={card}
          mode={mode}
          selected={mode === 'select' ? selectedCardId === card.id : undefined}
          onSelect={onSelect}
          onSetDefault={onSetDefault}
          onRemove={onRemove}
          isRemoving={removingId === card.id}
        />
      ))}
    </div>
  )
}

// Skeleton card 64px height com animação de pulso via opacity
function SkeletonCard() {
  return (
    <div
      style={{
        height: 64,
        borderRadius: 22,
        background: 'var(--color-surface-2)',
        animation: 'savedcard-pulse 1.4s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes savedcard-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
