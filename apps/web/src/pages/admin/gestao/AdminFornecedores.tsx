import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { Toast, useToast } from '../../../components/admin/Toast'
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
  isActive: boolean
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
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast, showToast } = useToast()

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

  // Ativar/desativar com update otimista + revert em caso de erro (inclui 409 do principal).
  const toggleFornecedor = useCallback(
    async (f: Fornecedor) => {
      const next = !f.isActive
      setBusyId(f.id)
      setFornecedores((prev) => prev.map((x) => (x.id === f.id ? { ...x, isActive: next } : x)))
      try {
        const res = await apiFetch(`/admin/suppliers/${f.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: next }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(err?.error || 'fail')
        }
        showToast(next ? `${f.name} reativado` : `${f.name} desativado`)
      } catch (e) {
        setFornecedores((prev) => prev.map((x) => (x.id === f.id ? { ...x, isActive: !next } : x)))
        const msg = e instanceof Error && e.message !== 'fail' ? e.message : 'Não foi possível atualizar.'
        showToast(msg, false)
      } finally {
        setBusyId(null)
      }
    },
    [showToast],
  )

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
          Fornecedores
        </h2>
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        {/* Botão Novo fornecedor */}
        <GoldBtn icon="plus" onClick={() => setSub('criar')}>
          Novo fornecedor
        </GoldBtn>

        {/* O rateio agora é por produto, na matriz de cada fornecedor (D-7) */}
        {!isLoading && <SourcingHintCard />}

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
                busy={busyId === f.id}
                onToggle={() => void toggleFornecedor(f)}
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
  busy: boolean
  onToggle: () => void
  onEdit: () => void
}

function FornecedorCard({ fornecedor: f, formatBRL, busy, onToggle, onEdit }: FornecedorCardProps) {
  const inactive = !f.isActive

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
          opacity: inactive ? 0.55 : 1,
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

      {/* Status — ativo/inativo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-2)',
        }}
      >
        <div style={{ minWidth: 0 }}>
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
          {f.isPrincipal && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--color-text-ter)',
                margin: '2px 0 0',
                lineHeight: 1.35,
              }}
            >
              Defina outro como principal para poder desativar.
            </p>
          )}
        </div>
        <SwitchToggle
          on={f.isActive}
          onChange={onToggle}
          disabled={busy || f.isPrincipal}
          aria-label="Ativar ou desativar fornecedor"
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ SourcingHintCard
/** Configura o percentual do fornecedor principal no split padrão do pedido. */
/**
 * SourcingHintCard — o antigo "Split padrão de compra" (um percentual GLOBAL do fornecedor
 * principal) virou LEGADO na Onda H: o rateio agora é POR PRODUTO, na matriz de fornecimento de
 * cada fornecedor (`SupplierProduct.defaultSharePct`).
 *
 * O `Setting.supplierSplitPrincipalPct` continua no banco — é a semente do backfill (D-10) — mas
 * editá-lo aqui não muda mais nada na geração do pedido. Em vez de remover o card e deixar quem o
 * conhecia sem saber para onde foi, ele aponta o novo lugar.
 */
function SourcingHintCard() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 14,
        marginTop: 12,
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
      }}
    >
      <Icon name="percent" size={16} color="var(--color-accent)" />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Rateio por produto
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '4px 0 0', lineHeight: 1.45 }}>
          Cada produto tem seus fornecedores, seu custo e sua fatia da demanda. Abra um fornecedor
          para definir o que ele fornece — é isso que o “Gerar direto” e a geração automática usam.
        </p>
      </div>
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
