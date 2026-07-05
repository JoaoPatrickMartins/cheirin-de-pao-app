import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'

// ------------------------------------------------------------------ tipos
interface HookItem {
  id: string
  name: string
  phone?: string | null
  apartment?: string | null
  block?: string | null
  condominiumId?: string | null
  condominiumName?: string | null
  hookRequestedAt: string | null
  hookDeliveredAt: string | null
}

type StatusFiltro = 'pending' | 'delivered' | 'all'

const STATUS_OPCOES: { id: StatusFiltro; label: string }[] = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'all', label: 'Todos' },
]

const PAGE_SIZE = 20

interface AdminGanchosProps {
  onBack: () => void
}

/** "12 jun, 09:14" a partir de um ISO 8601 (ou '—' se null). */
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/** Local do cliente: "Apto 302 · Bloco B" / "Apto 12" / condomínio. */
function localLabel(item: HookItem): string {
  const parts: string[] = []
  if (item.apartment) parts.push(`Apto ${item.apartment}`)
  if (item.block) parts.push(`Bloco ${item.block}`)
  return parts.join(' · ') || 'Sem apartamento'
}

// ------------------------------------------------------------------ componente
export function AdminGanchos({ onBack }: AdminGanchosProps) {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<StatusFiltro>('pending')

  const [items, setItems] = useState<HookItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // ação de entrega
  const [confirmItem, setConfirmItem] = useState<HookItem | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  // debounce da busca (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const buildUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams()
      if (debouncedQ) params.set('q', debouncedQ)
      params.set('status', status)
      params.set('page', String(p))
      params.set('limit', String(PAGE_SIZE))
      return `/admin/hook-requests?${params.toString()}`
    },
    [debouncedQ, status],
  )

  // refetch quando busca/filtro mudam (volta para página 1)
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setPage(1)
    ;(async () => {
      try {
        const res = await apiFetch(buildUrl(1))
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { items: HookItem[]; total: number }
        if (!cancelled) {
          setItems(data.items)
          setTotal(data.total)
        }
      } catch {
        // falha silenciosa
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [buildUrl])

  const loadMore = async () => {
    const next = page + 1
    setIsLoadingMore(true)
    try {
      const res = await apiFetch(buildUrl(next))
      if (res.ok) {
        const data = (await res.json()) as { items: HookItem[]; total: number }
        setItems((prev) => [...prev, ...data.items])
        setTotal(data.total)
        setPage(next)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoadingMore(false)
    }
  }

  const refetch = useCallback(async () => {
    setPage(1)
    try {
      const res = await apiFetch(buildUrl(1))
      if (res.ok) {
        const data = (await res.json()) as { items: HookItem[]; total: number }
        setItems(data.items)
        setTotal(data.total)
      }
    } catch {
      // falha silenciosa
    }
  }, [buildUrl])

  const handleDeliver = async () => {
    if (!confirmItem) return
    setConfirmBusy(true)
    try {
      const res = await apiFetch(`/admin/hook-requests/${confirmItem.id}/deliver`, { method: 'PATCH' })
      if (res.ok) {
        setConfirmItem(null)
        await refetch()
      }
    } catch {
      // falha silenciosa
    } finally {
      setConfirmBusy(false)
    }
  }

  const hasMore = items.length < total

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Solicitação de Gancho
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
            Entregas de gancho de porta
          </p>
        </div>
      </div>

      {/* Busca */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 10px', alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 999,
            padding: '0 12px',
            minHeight: 44,
          }}
        >
          <Icon name="search" size={18} stroke={2} color="var(--color-text-ter)" aria-hidden="true" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, apto, bloco ou telefone"
            aria-label="Buscar solicitações de gancho"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text)',
              minWidth: 0,
            }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              aria-label="Limpar busca"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
            >
              <Icon name="x" size={16} stroke={2} color="var(--color-text-ter)" />
            </button>
          )}
        </div>
      </div>

      {/* Chips de status */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
        {STATUS_OPCOES.map((opt) => {
          const ativo = status === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setStatus(opt.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                border: ativo ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border-2)',
                background: ativo ? 'var(--color-gold-soft)' : 'transparent',
                color: ativo ? 'var(--color-accent)' : 'var(--color-text-ter)',
                minHeight: 40,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div style={{ overflow: 'auto', flex: 1, padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>Carregando...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ paddingTop: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={28} color="var(--color-text-ter)" />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-ter)' }}>
              {status === 'pending'
                ? 'Nenhuma solicitação pendente.'
                : status === 'delivered'
                  ? 'Nenhum gancho entregue ainda.'
                  : 'Nenhuma solicitação de gancho.'}
            </span>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <HookCard key={item.id} item={item} onDeliver={() => setConfirmItem(item)} />
            ))}
            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                style={{
                  marginTop: 4,
                  minHeight: 44,
                  borderRadius: 14,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  cursor: isLoadingMore ? 'wait' : 'pointer',
                  opacity: isLoadingMore ? 0.6 : 1,
                }}
              >
                {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>

      <ConfirmSheet
        open={confirmItem !== null}
        title="Marcar gancho como entregue?"
        description={
          confirmItem
            ? `Confirma que o gancho de ${confirmItem.name} (${localLabel(confirmItem)}) foi entregue? O cliente será notificado.`
            : undefined
        }
        confirmLabel="Marcar entregue"
        cancelLabel="Cancelar"
        busy={confirmBusy}
        onConfirm={() => void handleDeliver()}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  )
}

// ------------------------------------------------------------------ HookCard
function HookCard({ item, onDeliver }: { item: HookItem; onDeliver: () => void }) {
  const entregue = item.hookDeliveredAt != null

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--color-accent)',
          }}
        >
          <Icon name="user" size={22} color="var(--color-accent)" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
            {item.name}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-ter)', margin: '2px 0 0', lineHeight: 1.3 }}>
            {localLabel(item)}
          </p>
          {item.condominiumName && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-ter)', margin: '2px 0 0', lineHeight: 1.3 }}>
              {item.condominiumName}
            </p>
          )}
        </div>

        {/* Pílula de status */}
        <span
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: 999,
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            background: entregue ? 'var(--color-good-soft)' : 'var(--color-gold-soft)',
            color: entregue ? 'var(--color-good)' : 'var(--color-accent)',
          }}
        >
          {entregue ? 'Entregue' : 'Pendente'}
        </span>
      </div>

      {/* Datas + ação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Icon name="clock" size={13} color="var(--color-text-ter)" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-ter)' }}>
            {entregue ? `Entregue ${formatDate(item.hookDeliveredAt)}` : `Solicitado ${formatDate(item.hookRequestedAt)}`}
          </span>
        </div>

        {!entregue && (
          <button
            onClick={onDeliver}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--color-espresso)',
              color: '#FAF5EC',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon name="check" size={16} color="#FAF5EC" stroke={2.4} />
            Marcar entregue
          </button>
        )}
      </div>
    </div>
  )
}
