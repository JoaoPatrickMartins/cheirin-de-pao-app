import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import { Toast, useToast } from '../../../components/admin/Toast'
import { CondoForm } from './CondoForm'

// ------------------------------------------------------------------ tipos
interface Condo {
  id: string
  name: string
  type: 'SINGLE_ENTRANCE' | 'BLOCKS'
  numBlocks?: number | null
  isActive: boolean
  clientCount?: number
}

type SubTelaSub = null | 'criar' | 'editar'

interface AdminCondosProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function tipoLabel(tipo: Condo['type']): string {
  return tipo === 'SINGLE_ENTRANCE' ? 'Entrada única' : 'Blocos/Torres'
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

// ------------------------------------------------------------------ componente
export function AdminCondos({ onBack }: AdminCondosProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [condos, setCondos] = useState<Condo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<Condo | null>(null)
  const { toast, showToast } = useToast()

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

  // Aplica ativar/desativar com update otimista + revert em caso de erro.
  const performToggle = useCallback(
    async (condo: Condo, next: boolean) => {
      setBusyId(condo.id)
      setCondos((prev) => prev.map((c) => (c.id === condo.id ? { ...c, isActive: next } : c)))
      try {
        const res = await apiFetch(`/admin/condominiums/${condo.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: next }),
        })
        if (!res.ok) throw new Error('patch failed')
        showToast(next ? `${condo.name} reativado` : `${condo.name} desativado`)
      } catch {
        setCondos((prev) => prev.map((c) => (c.id === condo.id ? { ...c, isActive: !next } : c)))
        showToast('Não foi possível atualizar. Tente novamente.', false)
      } finally {
        setBusyId(null)
      }
    },
    [showToast],
  )

  // Desativar com clientes vinculados pede confirmação; o resto é direto.
  const requestToggle = useCallback(
    (condo: Condo) => {
      const next = !condo.isActive
      if (!next && (condo.clientCount ?? 0) > 0) {
        setPending(condo)
        return
      }
      void performToggle(condo, next)
    },
    [performToggle],
  )

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
                busy={busyId === c.id}
                onEdit={() => {
                  setEditId(c.id)
                  setSub('editar')
                }}
                onToggle={() => requestToggle(c)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet
        open={!!pending}
        title={pending ? `Desativar ${pending.name}?` : ''}
        description={
          pending
            ? `${plural(pending.clientCount ?? 0, 'cliente ativo', 'clientes ativos')} ${
                (pending.clientCount ?? 0) === 1 ? 'deixará' : 'deixarão'
              } de receber entregas e nenhum pedido novo será gerado. Você pode reativar quando quiser.`
            : ''
        }
        confirmLabel="Desativar"
        tone="danger"
        onConfirm={() => {
          const condo = pending
          setPending(null)
          if (condo) void performToggle(condo, false)
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

// ------------------------------------------------------------------ CondoCard
interface CondoCardProps {
  condo: Condo
  busy: boolean
  onEdit: () => void
  onToggle: () => void
}

function CondoCard({ condo: c, busy, onEdit, onToggle }: CondoCardProps) {
  const clienteCount = c.clientCount ?? 0
  const inactive = !c.isActive

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Linha clicável → editar */}
      <button
        type="button"
        onClick={onEdit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
          opacity: inactive ? 0.55 : 1,
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
            {clienteCount > 0 ? ` · ${plural(clienteCount, 'cliente', 'clientes')}` : ''}
          </p>
        </div>

        {/* Chevron */}
        <Icon name="chevR" size={18} color="var(--color-text-ter)" />
      </button>

      {/* Rodapé — status ativo/inativo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--color-border-2)',
          marginTop: 14,
          paddingTop: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: inactive ? 'var(--color-text-ter)' : 'var(--color-text-sec)',
          }}
        >
          {inactive ? 'Inativo' : 'Ativo'}
        </span>
        <SwitchToggle
          on={c.isActive}
          onChange={onToggle}
          disabled={busy}
          aria-label="Ativar ou desativar condomínio"
        />
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
