import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { CondoForm } from './CondoForm'

// ------------------------------------------------------------------ tipos
interface Condo {
  id: string
  name: string
  type: 'SINGLE_ENTRANCE' | 'BLOCKS'
  numBlocks?: number | null
  _count?: { users?: number }
}

type SubTelaSub = null | 'criar' | 'editar'

interface AdminCondosProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function tipoLabel(tipo: Condo['type']): string {
  return tipo === 'SINGLE_ENTRANCE' ? 'Entrada única' : 'Blocos/Torres'
}

// ------------------------------------------------------------------ componente
export function AdminCondos({ onBack }: AdminCondosProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [condos, setCondos] = useState<Condo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCondos = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/condominiums')
      if (res.ok) {
        setCondos((await res.json()) as Condo[])
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCondos()
  }, [fetchCondos])

  if (sub === 'criar') {
    return (
      <CondoForm
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchCondos()
        }}
      />
    )
  }

  if (sub === 'editar' && editId) {
    return (
      <CondoForm
        id={editId}
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchCondos()
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
          Condomínios
        </h2>
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        <GoldBtn icon="plus" onClick={() => setSub('criar')}>
          Adicionar condomínio
        </GoldBtn>

        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {condos.map((c) => (
              <CondoCard
                key={c.id}
                condo={c}
                onClick={() => {
                  setEditId(c.id)
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

// ------------------------------------------------------------------ CondoCard
interface CondoCardProps {
  condo: Condo
  onClick: () => void
}

function CondoCard({ condo: c, onClick }: CondoCardProps) {
  const clienteCount = c._count?.users ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
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
        <Icon name="building" size={22} color="var(--color-accent)" />
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
            textAlign: 'left',
          }}
        >
          {c.name}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-text-ter)',
            margin: '2px 0 0',
            textAlign: 'left',
          }}
        >
          {tipoLabel(c.type)}
          {c.type === 'BLOCKS' && c.numBlocks ? ` · ${c.numBlocks} blocos` : ''}
          {clienteCount > 0 ? ` · ${clienteCount} cliente${clienteCount !== 1 ? 's' : ''}` : ''}
        </p>
      </div>

      {/* Chevron */}
      <Icon name="chevR" size={18} color="var(--color-text-ter)" />
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
