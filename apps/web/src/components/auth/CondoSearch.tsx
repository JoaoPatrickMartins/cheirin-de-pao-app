import { useState } from 'react'
import { Icon } from '../brand/Icon'

interface Condo {
  id: string
  name: string
  type: string
  neighborhood: string
}

interface CondoSearchProps {
  condos: Condo[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * Searchable condominium list with empty state.
 * Filters by name (case-insensitive). Shows empty state when no condos match.
 */
export function CondoSearch({ condos, selectedId, onSelect }: CondoSearchProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const filtered = condos.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  )

  const isEmpty = filtered.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Search field */}
      <label style={{ display: 'block' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--color-surface-alt)',
            border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-field)',
            padding: '12px 14px',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Icon name="building" size={18} color="var(--color-text-ter)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Buscar condomínio"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              color: 'var(--color-text)',
              minWidth: 0,
            }}
          />
        </div>
      </label>

      {/* Scrollable list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginTop: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {isEmpty ? (
          /* Empty state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '24px 16px',
            }}
          >
            <Icon name="building" size={28} color="var(--color-text-ter)" />
            <p
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                color: 'var(--color-text-ter)',
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              Seu condomínio ainda não é parceiro.
              <br />
              Avise a gente que levamos o cheirin até aí!
            </p>
          </div>
        ) : (
          filtered.map((condo) => {
            const isSelected = selectedId === condo.id
            const typeLabel =
              condo.type === 'BLOCKS' ? 'blocos/torres' : 'entrada única'
            return (
              <div
                key={condo.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(condo.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(condo.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: 16,
                  borderRadius: 'var(--radius-card)',
                  border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                {/* Condo icon container */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="building" size={20} color="var(--color-accent)" />
                </div>

                {/* Condo info */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize: 15,
                      color: 'var(--color-text)',
                    }}
                  >
                    {condo.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--color-text-ter)',
                      marginTop: 1,
                    }}
                  >
                    {condo.neighborhood} · {typeLabel}
                  </div>
                </div>

                {/* Check icon when selected */}
                {isSelected && (
                  <Icon name="check" size={20} color="var(--color-accent)" />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
