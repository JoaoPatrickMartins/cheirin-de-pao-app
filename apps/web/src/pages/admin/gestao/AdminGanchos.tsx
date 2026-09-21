import { useState, useEffect, useCallback, useMemo } from 'react'
import { blockLabel, formatUnit } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { HOOK_TYPE_BADGE, type HookStatus, type HookType } from '../../../lib/hookLabels'
import { Icon } from '../../../components/brand/Icon'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import { usePrintQueue } from '../../../components/admin/coupon/CouponShell'
import { HookCouponSheet, type HookCouponData } from '../../../components/admin/coupon/HookCoupon'

// ------------------------------------------------------------------ tipos
interface HookItem {
  id: string
  userId: string
  type: HookType
  status: HookStatus
  reason?: string | null
  name: string
  phone?: string | null
  apartment?: string | null
  block?: string | null
  complement?: string | null
  condominiumId?: string | null
  condominiumName?: string | null
  requestedAt: string | null
  deliveredAt: string | null
}

type StatusFiltro = 'pending' | 'delivered' | 'all'
type TipoFiltro = 'all' | 'free' | 'paid' | 'bonus'

const STATUS_OPCOES: { id: StatusFiltro; label: string }[] = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'all', label: 'Todos' },
]

const TIPO_OPCOES: { id: TipoFiltro; label: string }[] = [
  { id: 'all', label: 'Todos os tipos' },
  { id: 'free', label: 'Grátis' },
  { id: 'paid', label: 'Pagos' },
  { id: 'bonus', label: 'Bônus' },
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

/** "12/06" para o cupom — data curta com barra, que é como a térmica costuma ser lida. */
function formatDateShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** HookItem → cupom impresso. O endereço sai do mesmo `formatUnit` da rota do entregador. */
function toCoupon(item: HookItem): HookCouponData {
  return {
    hookRequestId: item.id,
    clientName: item.name,
    condominiumName: item.condominiumName ?? '',
    block: item.block ?? '',
    complement: item.complement ?? '',
    apartment: item.apartment ?? '',
    typeLabel: HOOK_TYPE_BADGE[item.type].label,
    reason: item.reason ?? '',
    dateLabel: item.requestedAt ? `Solicitado em ${formatDateShort(item.requestedAt)}` : '',
  }
}

/** Local do cliente: "Bloco B · Lado A · Apto 302" / "Apto 12" / condomínio. */
function localLabel(item: HookItem): string {
  if (!item.apartment && !item.block && !item.complement) return 'Sem apartamento'
  return formatUnit(item, { emptyApartment: '' })
}

/** Sem o bloco — usado no card quando o bloco já é o cabeçalho da seção. O complemento
    fica, porque distingue as portas DENTRO do mesmo bloco. */
function aptLabel(item: HookItem): string {
  if (!item.apartment && !item.complement) return 'Sem apartamento'
  return formatUnit(item, { block: 'omit', emptyApartment: '' })
}

/**
 * Agrupa itens contíguos por condomínio (a lista já vem ordenada do backend por
 * condomínio → bloco → complemento → apartamento, então basta quebrar em subgrupos contíguos).
 */
function groupByCondo(items: HookItem[]): Array<{ condominiumId: string | null; condominiumName: string | null; items: HookItem[] }> {
  const groups: Array<{ condominiumId: string | null; condominiumName: string | null; items: HookItem[] }> = []
  for (const item of items) {
    const cid = item.condominiumId ?? null
    const last = groups[groups.length - 1]
    if (last && last.condominiumId === cid) last.items.push(item)
    else groups.push({ condominiumId: cid, condominiumName: item.condominiumName ?? null, items: [item] })
  }
  return groups
}

/** Agrupa itens contíguos por bloco (preserva a ordem já recebida). */
function groupByBlock(items: HookItem[]): Array<{ block: string | null; items: HookItem[] }> {
  const groups: Array<{ block: string | null; items: HookItem[] }> = []
  for (const item of items) {
    const b = item.block && item.block.trim() ? item.block.trim() : null
    const last = groups[groups.length - 1]
    if (last && last.block === b) last.items.push(item)
    else groups.push({ block: b, items: [item] })
  }
  return groups
}

// ------------------------------------------------------------------ componente
export function AdminGanchos({ onBack }: AdminGanchosProps) {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<StatusFiltro>('pending')
  const [tipo, setTipo] = useState<TipoFiltro>('all')

  const [items, setItems] = useState<HookItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Quantos ganchos aguardam entrega — independe do filtro na tela, por isso vem de /summary
  // e não do `total` da listagem (que muda quando o admin olha "Entregues" ou filtra por tipo).
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  // ação de entrega
  const [confirmItem, setConfirmItem] = useState<HookItem | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  // seleção para impressão em lote + fila de impressão
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const { queue: coupons, print } = usePrintQueue<HookCouponData>()

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
      if (tipo !== 'all') params.set('type', tipo)
      // Agrupar por condomínio → bloco → apartamento: o backend ordena o conjunto
      // completo antes de paginar, então os grupos ficam coerentes entre páginas.
      params.set('sort', 'location')
      params.set('page', String(p))
      params.set('limit', String(PAGE_SIZE))
      return `/admin/hook-requests?${params.toString()}`
    },
    [debouncedQ, status, tipo],
  )

  const refreshPending = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/hook-requests/summary')
      if (res.ok) {
        const data = (await res.json()) as { pending: number }
        setPendingCount(data.pending)
      }
    } catch {
      // falha silenciosa — o contador some, a fila continua funcionando
    }
  }, [])

  useEffect(() => {
    void refreshPending()
  }, [refreshPending])

  // refetch quando busca/filtro mudam (volta para página 1). A seleção é limpa junto: os ids
  // marcados podem nem estar na nova lista, e um lote que imprime cupom fora do filtro visível
  // seria impossível de conferir antes de mandar para a térmica.
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setPage(1)
    setSelected(new Set())
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
        // Poda a seleção: o gancho recém-entregue sai da lista "Pendentes" e não pode
        // continuar contando na barra de impressão.
        const visiveis = new Set(data.items.map((i) => i.id))
        setSelected((prev) => new Set([...prev].filter((id) => visiveis.has(id))))
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
        await Promise.all([refetch(), refreshPending()])
      }
    } catch {
      // falha silenciosa
    } finally {
      setConfirmBusy(false)
    }
  }

  const hasMore = items.length < total

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  // Ordem de impressão = ordem da tela (condomínio → bloco → apartamento), para o lote sair da
  // térmica na mesma sequência em que os ganchos são separados.
  const selectedCoupons = useMemo(
    () => items.filter((i) => selected.has(i.id)).map(toCoupon),
    [items, selected],
  )

  const renderCard = (item: HookItem) => (
    <HookCard
      key={item.id}
      item={item}
      selected={selected.has(item.id)}
      onToggleSelect={() => toggleSelected(item.id)}
      onPrint={() => print([toCoupon(item)])}
      onDeliver={() => setConfirmItem(item)}
      onViewClient={() =>
        window.dispatchEvent(new CustomEvent('cdp:open-admin-client', { detail: { clientId: item.userId } }))
      }
    />
  )

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

        {/* Pendências — o número que o admin veio ver, antes de qualquer filtro. */}
        {pendingCount !== null && pendingCount > 0 && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 54,
              padding: '6px 10px',
              borderRadius: 12,
              background: 'var(--color-gold-soft)',
              border: '1px solid var(--color-accent)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--color-accent)', lineHeight: 1 }}>
              {pendingCount}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.02em', marginTop: 2 }}>
              {pendingCount === 1 ? 'pendente' : 'pendentes'}
            </span>
          </div>
        )}
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
          // Só o chip "Pendentes" carrega número: é o único cuja contagem o admin usa para decidir.
          const contagem = opt.id === 'pending' && pendingCount !== null && pendingCount > 0 ? pendingCount : null
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
                gap: 6,
              }}
            >
              {opt.label}
              {contagem !== null && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: ativo ? 'var(--color-accent)' : 'var(--color-gold-soft)',
                    color: ativo ? '#FAF5EC' : 'var(--color-accent)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {contagem}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Chips de tipo */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 20px 4px', scrollbarWidth: 'none' }}>
        {TIPO_OPCOES.map((opt) => {
          const ativo = tipo === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setTipo(opt.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                border: ativo ? '1.5px solid var(--color-espresso)' : '1.5px solid var(--color-border-2)',
                background: ativo ? 'var(--color-espresso)' : 'transparent',
                color: ativo ? '#FAF5EC' : 'var(--color-text-ter)',
                minHeight: 34,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Lista — o rodapé cresce quando a barra de seleção está no ar, para o último card
          não ficar embaixo dela. */}
      <div
        style={{
          overflow: 'auto',
          flex: 1,
          padding: selected.size > 0 ? '12px 20px 104px' : '12px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
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
            {/* Seleção em massa — opera só sobre o que já foi carregado; com a lista paginada,
                prometer "todos" seria mentira na hora de imprimir. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                {items.length} de {total} {total === 1 ? 'solicitação' : 'solicitações'}
              </span>
              <button
                onClick={toggleAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: '1.5px solid var(--color-border)',
                  background: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  cursor: 'pointer',
                }}
              >
                {allSelected ? 'Limpar seleção' : `Selecionar ${items.length === 1 ? 'o item' : `os ${items.length} carregados`}`}
              </button>
            </div>
            {groupByCondo(items).map((condo) => {
              const hasBlocks = condo.items.some((i) => i.block && i.block.trim())
              return (
                <div key={condo.condominiumId ?? '—'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Cabeçalho do condomínio */}
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      color: 'var(--color-text)',
                      margin: '4px 0 0',
                    }}
                  >
                    {condo.condominiumName ?? 'Sem condomínio'}
                  </p>
                  {hasBlocks
                    ? groupByBlock(condo.items).map((g) => (
                        <div key={g.block ?? '—'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Subcabeçalho do bloco */}
                          <p
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: 'var(--color-text-ter)',
                              margin: '2px 0 0',
                            }}
                          >
                            {g.block ? blockLabel(g.block) : 'Sem bloco'}
                          </p>
                          {g.items.map(renderCard)}
                        </div>
                      ))
                    : condo.items.map(renderCard)}
                </div>
              )
            })}
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

      {/* Barra da seleção — fixa acima da nav do admin (56px + safe area), como na Separação:
          o botão precisa estar ao alcance sem rolar até o fim de uma fila longa.
          zIndex abaixo da nav (50) e das folhas de confirmação (100+). */}
      {selected.size > 0 && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
            zIndex: 40,
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
            boxShadow: '0 -8px 24px rgba(30, 18, 7, 0.08)',
            padding: '12px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
            {selected.size} {selected.size === 1 ? 'selecionado' : 'selecionados'}
          </span>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              minHeight: 46,
              padding: '0 14px',
              borderRadius: 16,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text-sec)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Limpar
          </button>
          <button
            onClick={() => print(selectedCoupons)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 46,
              padding: '0 18px',
              borderRadius: 16,
              border: 'none',
              background: 'var(--color-espresso)',
              color: '#FAF5EC',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="doc" size={16} stroke={2} color="#FAF5EC" />
            Imprimir {selected.size === 1 ? 'cupom' : `${selected.size} cupons`}
          </button>
        </div>
      )}

      {/* Folha de cupons (oculta na tela; impressa via window.print) */}
      <HookCouponSheet coupons={coupons} />

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
function HookCard({
  item,
  selected,
  onToggleSelect,
  onPrint,
  onDeliver,
  onViewClient,
}: {
  item: HookItem
  selected: boolean
  onToggleSelect: () => void
  onPrint: () => void
  onDeliver: () => void
  onViewClient: () => void
}) {
  const entregue = item.status === 'DELIVERED'
  const badge = HOOK_TYPE_BADGE[item.type]

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: selected ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* A caixa de seleção ocupa o lugar do avatar: é a coluna que o olho varre ao montar
            o lote, e o avatar genérico não informava nada que o nome já não dissesse. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Selecionar gancho de ${item.name}`}
          onClick={onToggleSelect}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: selected ? 'none' : '1.5px solid var(--color-border)',
            background: selected ? 'var(--color-accent)' : 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {selected ? (
            <Icon name="check" size={22} stroke={2.6} color="#FAF5EC" />
          ) : (
            <Icon name="user" size={22} color="var(--color-accent)" />
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
            {item.name}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-ter)', margin: '2px 0 0', lineHeight: 1.3 }}>
            {aptLabel(item)}
          </p>
        </div>

        {/* Pílulas de tipo + status */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              background: badge.bg,
              color: badge.fg,
            }}
          >
            {badge.label}
          </span>
          <span
            style={{
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
      </div>

      {/* Motivo (defeito/perda no pago; bonificação no bônus) */}
      {item.reason && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-text-sec)',
            margin: 0,
            padding: '8px 10px',
            background: 'var(--color-surface-2)',
            borderRadius: 10,
            lineHeight: 1.4,
          }}
        >
          {item.reason}
        </p>
      )}

      {/* Datas + ação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          rowGap: 10,
          flexWrap: 'wrap',
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Icon name="clock" size={13} color="var(--color-text-ter)" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-ter)' }}>
            {entregue ? `Entregue ${formatDate(item.deliveredAt)}` : `Solicitado ${formatDate(item.requestedAt)}`}
          </span>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onViewClient}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 12,
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-sec)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon name="user" size={16} color="var(--color-text-sec)" />
            Ver cliente
          </button>

          {/* Impressão avulsa — imprimir NÃO registra entrega: o cupom sai na montagem, a
              entrega é marcada quando o gancho chega na porta. */}
          <button
            onClick={onPrint}
            aria-label={`Imprimir cupom do gancho de ${item.name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 12,
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-sec)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon name="doc" size={16} stroke={2} color="var(--color-text-sec)" />
            Cupom
          </button>

          {!entregue && (
            <button
              onClick={onDeliver}
              style={{
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
    </div>
  )
}
