import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import { Toast, useToast } from '../../../components/admin/Toast'
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
  isActive: boolean
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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<Combo | null>(null)
  const { toast, showToast } = useToast()

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

  // Ativa/desativa o combo com update otimista. Ao desativar, o backend desliga a
  // compra automática dos clientes que o usam e retorna affectedAutoRecharge.
  const performToggleActive = useCallback(
    async (combo: Combo, next: boolean) => {
      setBusyId(combo.id)
      setCombos((prev) => prev.map((c) => (c.id === combo.id ? { ...c, isActive: next } : c)))
      try {
        const res = await apiFetch(`/admin/combos/${combo.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: next }),
        })
        if (!res.ok) throw new Error('patch failed')
        if (next) {
          showToast(`${combo.name} reativado`)
        } else {
          const data = (await res.json().catch(() => null)) as { affectedAutoRecharge?: number } | null
          const n = data?.affectedAutoRecharge ?? 0
          showToast(
            n > 0
              ? `Combo desativado · ${n} compra${n !== 1 ? 's' : ''} automática${n !== 1 ? 's' : ''} desligada${n !== 1 ? 's' : ''}`
              : 'Combo desativado',
          )
        }
      } catch {
        setCombos((prev) => prev.map((c) => (c.id === combo.id ? { ...c, isActive: !next } : c)))
        showToast('Não foi possível atualizar. Tente novamente.', false)
      } finally {
        setBusyId(null)
      }
    },
    [showToast],
  )

  // Desativar pede confirmação (afeta a compra automática); reativar é direto.
  const requestToggleActive = useCallback(
    (combo: Combo) => {
      const next = !combo.isActive
      if (!next) {
        setPending(combo)
        return
      }
      void performToggleActive(combo, true)
    },
    [performToggleActive],
  )

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
      <Toast toast={toast} />

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
                busy={busyId === combo.id}
                onEdit={() => {
                  setEditId(combo.id)
                  setSub('editar')
                }}
                onToggleActive={() => requestToggleActive(combo)}
                onTogglePromo={() => void togglePromo(combo, setCombos)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet
        open={!!pending}
        title={pending ? `Desativar ${pending.name}?` : ''}
        description="O combo sai da loja e os clientes que o usam na compra automática terão a recarga desligada. Você pode reativar quando quiser."
        confirmLabel="Desativar"
        tone="danger"
        onConfirm={() => {
          const combo = pending
          setPending(null)
          if (combo) void performToggleActive(combo, false)
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

// ------------------------------------------------------------------ toggle de promoção (otimista)
async function togglePromo(
  combo: Combo,
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
  busy: boolean
  onEdit: () => void
  onToggleActive: () => void
  onTogglePromo: () => void
}

function ComboCard({ combo, busy, onEdit, onToggleActive, onTogglePromo }: ComboCardProps) {
  const promoAtiva = combo.discount?.active === true
  const inactive = !combo.isActive

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: inactive ? 0.55 : 1 }}>
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

      {/* Status — disponível na loja (ativo/inativo) */}
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
          <Icon name="bag" size={16} color="var(--color-text-sec)" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              color: inactive ? 'var(--color-text-ter)' : 'var(--color-text-sec)',
            }}
          >
            {inactive ? 'Inativo — fora da loja' : 'Ativo na loja'}
          </span>
        </div>
        <SwitchToggle
          on={combo.isActive}
          onChange={onToggleActive}
          disabled={busy}
          aria-label="Ativar ou desativar combo"
        />
      </div>

      {/* Promoção */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-2)',
          opacity: inactive ? 0.55 : 1,
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
        <SwitchToggle
          on={promoAtiva}
          onChange={onTogglePromo}
          disabled={inactive}
          aria-label="Ativar ou desativar promoção"
        />
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
