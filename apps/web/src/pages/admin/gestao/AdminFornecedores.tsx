import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { FornecedorForm } from './FornecedorForm'

// ------------------------------------------------------------------ tipos
interface Fornecedor {
  id: string
  name: string
  cnpj?: string | null
  phone?: string | null
  email?: string | null
  pricePerUnit: number
  isPrincipal: boolean
}

type SubTelaSub = null | 'criar' | 'editar'

interface AdminFornecedoresProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/** Formata um CNPJ (com ou sem máscara) para 00.000.000/0000-00. */
function formatCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Formata telefone para (00) 0000-0000 ou (00) 00000-0000. */
function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1')
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2')
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

// ------------------------------------------------------------------ componente
export function AdminFornecedores({ onBack }: AdminFornecedoresProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchFornecedores = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/suppliers')
      if (res.ok) {
        setFornecedores((await res.json()) as Fornecedor[])
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFornecedores()
  }, [fetchFornecedores])

  if (sub === 'criar') {
    return (
      <FornecedorForm
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchFornecedores()
        }}
      />
    )
  }

  if (sub === 'editar' && editId) {
    return (
      <FornecedorForm
        id={editId}
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchFornecedores()
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
          Fornecedores
        </h2>
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        {/* Botão Novo fornecedor */}
        <GoldBtn icon="plus" onClick={() => setSub('criar')}>
          Novo fornecedor
        </GoldBtn>

        {/* Split padrão usado pelo "Gerar direto" e pela geração automática no corte */}
        {!isLoading && <SplitDefaultCard hasReserva={fornecedores.some((f) => !f.isPrincipal)} />}

        {/* Lista */}
        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {fornecedores.map((f) => (
              <FornecedorCard
                key={f.id}
                fornecedor={f}
                formatBRL={formatBRL}
                onEdit={() => {
                  setEditId(f.id)
                  setSub('editar')
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ FornecedorCard
interface FornecedorCardProps {
  fornecedor: Fornecedor
  formatBRL: (v: number) => string
  onEdit: () => void
}

function FornecedorCard({ fornecedor: f, formatBRL, onEdit }: FornecedorCardProps) {
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
          <Icon name="factory" size={22} color="var(--color-accent)" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              {f.name}
            </p>
            {f.isPrincipal && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  background: 'rgba(227,172,63,0.14)',
                  borderRadius: 99,
                  padding: '2px 8px',
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                Principal
              </span>
            )}
          </div>
          {f.cnpj && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-ter)',
                margin: '2px 0 0',
              }}
            >
              {formatCNPJ(f.cnpj)}
            </p>
          )}
        </div>

        {/* Botão editar */}
        <button
          type="button"
          aria-label={`Editar fornecedor ${f.name}`}
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

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="coin" size={13} color="var(--color-text-ter)" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-sec)',
            }}
          >
            Preço por pão: {formatBRL(f.pricePerUnit)}
          </span>
        </div>
        {f.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="phone" size={13} color="var(--color-text-ter)" />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-ter)',
              }}
            >
              {formatPhone(f.phone)}
            </span>
          </div>
        )}
        {f.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="mail" size={13} color="var(--color-text-ter)" />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-ter)',
              }}
            >
              {f.email}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ SplitDefaultCard
/** Configura o percentual do fornecedor principal no split padrão do pedido. */
function SplitDefaultCard({ hasReserva }: { hasReserva: boolean }) {
  const [pct, setPct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    apiFetch('/admin/supplier-orders/default-split')
      .then(async (r) => {
        if (r.ok && active) setPct((((await r.json()) as { principalPercent: number }).principalPercent))
      })
      .catch(() => {
        /* falha silenciosa */
      })
    return () => {
      active = false
    }
  }, [])

  async function save(next: number) {
    const v = Math.max(0, Math.min(100, next))
    setPct(v)
    setSaving(true)
    try {
      await apiFetch('/admin/supplier-orders/default-split', {
        method: 'PATCH',
        body: JSON.stringify({ principalPercent: v }),
      })
    } catch {
      /* falha silenciosa */
    } finally {
      setSaving(false)
    }
  }

  if (pct === null) return null

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="percent" size={16} color="var(--color-accent)" />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Split padrão de compra
        </p>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '0 0 12px', lineHeight: 1.4 }}>
        {hasReserva
          ? 'Divisão usada pelo “Gerar direto” e pela geração automática 1h após o corte.'
          : 'Com só um fornecedor, ele recebe 100%. A divisão vale quando houver reserva.'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
            {pct}% <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>principal</span>
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-accent)', margin: '2px 0 0', fontWeight: 700 }}>
            {100 - pct}% reserva
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.6 : 1 }}>
          <SplitStep label="−5%" disabled={saving || pct <= 0} onClick={() => void save(pct - 5)} />
          <SplitStep label="+5%" disabled={saving || pct >= 100} onClick={() => void save(pct + 5)} />
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        onPointerUp={(e) => void save(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => void save(Number((e.target as HTMLInputElement).value))}
        aria-label="Percentual do fornecedor principal"
        style={{ width: '100%', marginTop: 14, accentColor: 'var(--color-accent)' }}
      />
    </div>
  )
}

function SplitStep({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 48,
        minHeight: 38,
        borderRadius: 11,
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-surface)',
        fontFamily: 'var(--font-body)',
        fontSize: 13.5,
        fontWeight: 800,
        color: 'var(--color-text)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  )
}

// ------------------------------------------------------------------ GoldBtn
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
        background: 'var(--color-gold)',
        color: 'var(--color-espresso)',
        border: 'none',
        borderRadius: 14,
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '-0.01em',
      }}
    >
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-espresso)" />
      {children}
    </button>
  )
}
