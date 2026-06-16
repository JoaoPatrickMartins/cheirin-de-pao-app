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
  pricePerBread: number
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
              {f.cnpj}
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
            Preço por pão: {formatBRL(f.pricePerBread)}
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
              {f.phone}
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
