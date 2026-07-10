import { Icon } from '../brand/Icon'

export interface SavedCard {
  id: string
  brand: string
  lastFour: string
  expiresAt: string
  isDefault: boolean
}

interface SavedCardItemProps {
  card: SavedCard
  mode: 'select' | 'manage'
  // modo 'select'
  selected?: boolean
  onSelect?: (id: string) => void
  // modo 'manage'
  onSetDefault?: (id: string) => void
  onRemove?: (id: string) => void
  isRemoving?: boolean
}

function renderBrandIcon(brand: string) {
  const b = brand.toLowerCase()

  if (b === 'visa') {
    return (
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 12,
          color: '#1A1F71',
          background: 'var(--color-surface-2)',
          borderRadius: 4,
          padding: '2px 6px',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        VISA
      </span>
    )
  }

  if (b === 'master' || b === 'mastercard') {
    return (
      <svg
        width="32"
        height="20"
        viewBox="0 0 32 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="10" fill="#EB001B" />
        <circle cx="22" cy="10" r="10" fill="#F79E1B" opacity="0.9" />
      </svg>
    )
  }

  if (b === 'elo') {
    return (
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 12,
          color: 'var(--color-text)',
          background: 'var(--color-surface-2)',
          borderRadius: 4,
          padding: '2px 6px',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        ELO
      </span>
    )
  }

  // Outros: usar texto uppercase se reconhecível ou ícone genérico
  if (brand && brand.length > 0) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 11,
          color: 'var(--color-text)',
          background: 'var(--color-surface-2)',
          borderRadius: 4,
          padding: '2px 6px',
          letterSpacing: '0.02em',
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        {brand.slice(0, 6)}
      </span>
    )
  }

  return <Icon name="card" size={20} color="var(--color-text-ter)" />
}

export function SavedCardItem({
  card,
  mode,
  selected = false,
  onSelect,
  onSetDefault,
  onRemove,
  isRemoving = false,
}: SavedCardItemProps) {
  if (mode === 'select') {
    return (
      <div
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onClick={() => onSelect?.(card.id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(card.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 64,
          padding: 16,
          borderRadius: 22,
          background: 'var(--color-surface)',
          border: selected
            ? '2px solid var(--color-accent)'
            : '2px solid var(--color-border-2)',
          boxShadow: selected ? 'var(--shadow-strong)' : 'var(--shadow-soft)',
          cursor: 'pointer',
          transition: 'border 150ms ease-out, box-shadow 150ms ease-out',
          boxSizing: 'border-box',
        }}
      >
        {/* Ícone de bandeira */}
        <div style={{ display: 'flex', alignItems: 'center', width: 36, flexShrink: 0 }}>
          {renderBrandIcon(card.brand)}
        </div>

        {/* Dados do cartão */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 400,
              color: 'var(--color-text)',
            }}
          >
            •••• {card.lastFour}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-text-sec)',
            }}
          >
            {card.expiresAt}
          </span>
        </div>

        {/* Radio indicator 26×26px — idêntico ao ComboCard.tsx */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: selected
              ? '2px solid var(--color-accent)'
              : '2px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'border 150ms ease-out, background 150ms ease-out',
          }}
        >
          {selected && (
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: 'var(--color-accent)',
              }}
            />
          )}
        </div>
      </div>
    )
  }

  // mode === 'manage'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '12px 0',
      }}
    >
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Esquerda: bandeira + dados */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', width: 36, flexShrink: 0 }}>
            {renderBrandIcon(card.brand)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--color-text)',
              }}
            >
              •••• {card.lastFour}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                color: 'var(--color-text-sec)',
              }}
            >
              {card.expiresAt}
            </span>
          </div>
        </div>

        {/* Direita: badge Padrão ou botão Definir padrão */}
        <div>
          {card.isDefault ? (
            <span
              style={{
                background: 'var(--color-good-soft)',
                color: 'var(--color-good)',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                padding: '4px 10px',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >
              Padrão
            </span>
          ) : (
            <button
              onClick={() => onSetDefault?.(card.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              Definir como padrão
            </button>
          )}
        </div>
      </div>

      {/* Linha inferior: botão Remover */}
      <div>
        <button
          onClick={() => !isRemoving && onRemove?.(card.id)}
          disabled={isRemoving}
          style={{
            background: 'none',
            border: 'none',
            color: isRemoving ? 'var(--color-text-ter)' : '#C0392B',
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: isRemoving ? 'default' : 'pointer',
            padding: 0,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isRemoving ? 'Removendo...' : 'Remover'}
        </button>
      </div>
    </div>
  )
}
