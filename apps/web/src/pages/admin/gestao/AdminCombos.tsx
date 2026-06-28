import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { ComboForm } from './ComboForm'

// ------------------------------------------------------------------ tipos
interface DiscountEmbed {
  type: 'PERCENT' | 'FIXED'
  value: number
  expiresAt?: string | null
  active: boolean
}

interface Combo {
  id: string
  name: string
  quantity: number
  price: number
  tag?: string | null
  discount?: DiscountEmbed | null
}

type SubTelaSub = null | 'criar' | 'editar'

interface AdminCombosProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents)
}

function precoComDesconto(price: number, discount: DiscountEmbed): number {
  if (discount.type === 'PERCENT') {
    return price * (1 - discount.value / 100)
  }
  return Math.max(0, price - discount.value)
}

// ------------------------------------------------------------------ componente
export function AdminCombos({ onBack }: AdminCombosProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [combos, setCombos] = useState<Combo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCombos = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/combos')
      if (res.ok) {
        setCombos((await res.json()) as Combo[])
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCombos()
  }, [fetchCombos])

  if (sub === 'criar') {
    return (
      <ComboForm
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchCombos()
        }}
      />
    )
  }

  if (sub === 'editar' && editId) {
    return (
      <ComboForm
        id={editId}
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchCombos()
        }}
      />
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Combos e promoções
        </h2>
      </div>

      {/* Conteúdo scrollável */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        {/* Botão Novo combo */}
        <GoldBtn icon="plus" onClick={() => setSub('criar')}>
          Novo combo
        </GoldBtn>

        {/* Lista de combos */}
        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}
            >
              Carregando...
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {combos.map((combo) => (
              <ComboCard
                key={combo.id}
                combo={combo}
                onEdit={() => {
                  setEditId(combo.id)
                  setSub('editar')
                }}
                onTogglePromo={() => void togglePromo(combo, combos, setCombos)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ toggle otimista
async function togglePromo(
  combo: Combo,
  combos: Combo[],
  setCombos: React.Dispatch<React.SetStateAction<Combo[]>>,
) {
  const prevActive = combo.discount?.active ?? false
  const newActive = !prevActive

  // Atualização otimista
  setCombos((prev) =>
    prev.map((c) =>
      c.id === combo.id
        ? { ...c, discount: c.discount ? { ...c.discount, active: newActive } : { type: 'PERCENT', value: 15, active: newActive } }
        : c,
    ),
  )

  try {
    await apiFetch(`/admin/combos/${combo.id}/promotion`, {
      method: 'PATCH',
      body: JSON.stringify({ active: newActive }),
    })
  } catch {
    // Reverter em caso de erro
    setCombos((prev) =>
      prev.map((c) =>
        c.id === combo.id
          ? { ...c, discount: c.discount ? { ...c.discount, active: prevActive } : null }
          : c,
      ),
    )
  }
}

// ------------------------------------------------------------------ ComboCard
interface ComboCardProps {
  combo: Combo
  onEdit: () => void
  onTogglePromo: () => void
}

function ComboCard({ combo, onEdit, onTogglePromo }: ComboCardProps) {
  const promoAtiva = combo.discount?.active === true

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="bag" size={22} color="var(--color-accent)" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {combo.name}
            {combo.tag && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  marginLeft: 6,
                }}
              >
                · {combo.tag}
              </span>
            )}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-text-sec)',
              margin: '2px 0 0',
            }}
          >
            {combo.quantity} pães ·{' '}
            {promoAtiva && combo.discount ? (
              <>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-ter)' }}>
                  {formatBRL(combo.price)}
                </span>{' '}
                <span style={{ color: 'var(--color-good)', fontWeight: 700 }}>
                  {formatBRL(precoComDesconto(combo.price, combo.discount))}
                </span>
              </>
            ) : (
              <span>{formatBRL(combo.price)}</span>
            )}
          </p>
        </div>

        {/* Botão editar */}
        <button
          type="button"
          aria-label={`Editar combo ${combo.name}`}
          onClick={onEdit}
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="edit" size={17} color="var(--color-text-sec)" />
        </button>
      </div>

      {/* Footer: Switch de promoção */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="percent" size={17} color="var(--color-text-sec)" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-sec)',
            }}
          >
            Promoção {combo.discount?.value ?? 15}% OFF
          </span>
        </div>
        <SwitchToggle on={promoAtiva} onChange={onTogglePromo} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ primitivas locais
interface GoldBtnProps {
  icon: string
  onClick: () => void
  children: React.ReactNode
}

function GoldBtn({ icon, onClick, children }: GoldBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        minHeight: 44,
        background: 'var(--color-espresso)',
        color: '#FAF5EC',
        border: 'none',
        borderRadius: 14,
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '-0.01em',
      }}
    >
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="#FAF5EC" />
      {children}
    </button>
  )
}

interface SwitchToggleProps {
  on: boolean
  onChange: () => void
}

function SwitchToggle({ on, onChange }: SwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        border: 'none',
        background: on ? 'var(--color-gold)' : 'var(--color-border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
