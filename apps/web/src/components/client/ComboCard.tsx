interface Combo {
  id: string
  name: string
  quantity: number
  price: number
  isActive: boolean
  tag?: string
  description?: string | null
  economyPercent?: number | null
  economySavings?: number | null
  antes?: number
}

interface ComboCardProps {
  combo: Combo
  selected: boolean
  onSelect: () => void
}

const formatBRL = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ComboCard({ combo, selected, onSelect }: ComboCardProps) {
  // Economia calculada no backend (vs. comprar a mesma quantidade no avulso).
  // Vem null quando a tag está desligada ou não há economia positiva.
  const percent = combo.economyPercent ?? 0
  const savings = combo.economySavings ?? 0
  const showEconomy = percent > 0 && savings > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{
        position: 'relative',
        background: 'var(--color-surface)',
        borderRadius: 22,
        padding: 18,
        border: selected
          ? '2px solid var(--color-accent)'
          : '2px solid var(--color-border-2)',
        boxShadow: selected ? 'var(--shadow-strong)' : 'var(--shadow-soft)',
        transition: 'border-color .15s, box-shadow .15s',
        cursor: 'pointer',
        marginTop: combo.tag ? 10 : 0,
      }}
    >
      {combo.tag && (
        <span
          style={{
            position: 'absolute',
            top: -10,
            left: 18,
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: '3px 10px',
            fontFamily: 'var(--font-body)',
          }}
        >
          {combo.tag}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            {combo.name}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--color-text-sec)',
              margin: '2px 0 0 0',
            }}
          >
            {combo.quantity} pães
            {combo.description ? ` · ${combo.description}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right', marginRight: 12 }}>
          {combo.antes !== undefined && combo.antes > combo.price && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--color-text-ter)',
                textDecoration: 'line-through',
                margin: '0 0 1px 0',
              }}
            >
              {formatBRL(combo.antes)}
            </p>
          )}
          {/* Preço em segundo plano — a economia é o destaque do card */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--color-text-sec)',
              margin: 0,
            }}
          >
            {formatBRL(combo.price)}
          </p>
        </div>
        {/* Radio indicator */}
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

      {/* Economia — destaque principal do card */}
      {showEconomy && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 12,
            background: 'var(--color-good-soft)',
            borderRadius: 12,
            padding: '9px 12px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-good)',
            }}
          >
            Você economiza {formatBRL(savings)}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--color-good)',
              flexShrink: 0,
            }}
          >
            −{Math.round(percent)}%
          </span>
        </div>
      )}
    </div>
  )
}
