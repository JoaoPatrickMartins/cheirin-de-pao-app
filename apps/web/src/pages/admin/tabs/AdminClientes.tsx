import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { Icon } from '../../../components/brand/Icon'
import { ClientDetailView } from '../../../components/admin/ClientDetailView'

// ------------------------------------------------------------------ tipos
interface Cliente {
  id: string
  name: string
  condominiumId: string
  apartment: string
  block?: string
  creditBalance: number
  isBlocked: boolean
  createdAt: string
  lastPurchaseAt?: string | null
}

interface Condo {
  id: string
  name: string
  type: string
  isActive: boolean
}

interface ClientesPage {
  items: Cliente[]
  total: number
  page: number
  limit: number
}

type AdminClientesSub = null | 'detalhe'
type StatusFiltro = 'all' | 'blocked' | 'active' | 'no-credits'
type Ordenacao = 'name' | 'credits' | 'lastPurchase' | 'recent'

const LIMIT = 20

const STATUS_OPCOES: { id: StatusFiltro; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'blocked', label: 'Bloqueados' },
  { id: 'no-credits', label: 'Sem créditos' },
]

const SORT_OPCOES: { id: Ordenacao; label: string }[] = [
  { id: 'name', label: 'Nome (A–Z)' },
  { id: 'credits', label: 'Mais créditos' },
  { id: 'lastPurchase', label: 'Última compra' },
  { id: 'recent', label: 'Mais recentes' },
]

// ------------------------------------------------------------------ helpers
function formatDataCurta(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

// ------------------------------------------------------------------ skeleton
function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 18,
        border: '1px solid var(--color-border-2)',
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-surface-2)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ width: '55%', height: 13, borderRadius: 6, background: 'var(--color-surface-2)' }} />
        <div style={{ width: '80%', height: 11, borderRadius: 6, background: 'var(--color-surface-2)', marginTop: 8 }} />
      </div>
      <div style={{ width: 24, height: 22, borderRadius: 6, background: 'var(--color-surface-2)' }} />
    </div>
  )
}

// ------------------------------------------------------------------ componente
export function AdminClientes() {
  const [sub, setSub] = useState<AdminClientesSub>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // filtros / busca / ordenação
  const [filtroCondominio, setFiltroCondominio] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('all')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('name')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [showSortSheet, setShowSortSheet] = useState(false)

  // dados / paginação
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [condominios, setCondominios] = useState<Condo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const isFiltrando = debouncedQ.trim() !== '' || statusFiltro !== 'all' || filtroCondominio !== null
  const hasMore = clientes.length < total

  // Debounce da busca (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Buscar condomínios na montagem (apenas uma vez)
  useEffect(() => {
    const fetchCondos = async () => {
      try {
        const res = await apiFetch('/admin/condominiums')
        if (res.ok) {
          setCondominios((await res.json()) as Condo[])
        }
      } catch {
        // falha silenciosa
      }
    }
    void fetchCondos()
  }, [])

  // Monta a URL para uma página específica respeitando filtros/busca/ordenação
  const buildUrl = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams()
      if (filtroCondominio) params.set('condominiumId', filtroCondominio)
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim())
      if (statusFiltro !== 'all') params.set('status', statusFiltro)
      if (ordenacao !== 'name') params.set('sort', ordenacao)
      params.set('page', String(pagina))
      params.set('limit', String(LIMIT))
      return `/admin/clients?${params.toString()}`
    },
    [filtroCondominio, debouncedQ, statusFiltro, ordenacao],
  )

  // Refetch (página 1) sempre que filtros/busca/ordenação mudarem
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const fetchClientes = async () => {
      try {
        const res = await apiFetch(buildUrl(1))
        if (res.ok && !cancelled) {
          const data = (await res.json()) as ClientesPage
          setClientes(data.items)
          setTotal(data.total)
          setPage(1)
        }
      } catch {
        // falha silenciosa
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchClientes()
    return () => {
      cancelled = true
    }
  }, [buildUrl])

  // Carregar mais (próxima página, anexa à lista)
  async function loadMore() {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const proxima = page + 1
    try {
      const res = await apiFetch(buildUrl(proxima))
      if (res.ok) {
        const data = (await res.json()) as ClientesPage
        setClientes((prev) => [...prev, ...data.items])
        setTotal(data.total)
        setPage(proxima)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Sub-tela: detalhe do cliente
  if (sub === 'detalhe' && selectedId) {
    return (
      <ClientDetailView
        clienteId={selectedId}
        onBack={() => {
          setSub(null)
          setSelectedId(null)
        }}
      />
    )
  }

  // Nome do condomínio a partir do id
  function nomeCondominio(condominiumId: string): string {
    const condo = condominios.find((c) => c.id === condominiumId)
    return condo?.name ?? '—'
  }

  const subHead = isFiltrando
    ? `${total} ${total === 1 ? 'encontrado' : 'encontrados'}`
    : `${total} ${total === 1 ? 'cadastrado' : 'cadastrados'}`

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
      <AdminHead sub={subHead} titulo="Clientes" />

      {/* ---- Busca + ordenar ---- */}
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
            placeholder="Buscar por nome, CPF, e-mail ou telefone"
            aria-label="Buscar clientes"
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
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
                color: 'var(--color-text-ter)',
              }}
            >
              <Icon name="x" size={16} stroke={2} color="var(--color-text-ter)" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowSortSheet(true)}
          aria-label="Ordenar lista"
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 999,
            border: '1.5px solid var(--color-border)',
            background: ordenacao !== 'name' ? 'var(--color-gold-soft)' : 'var(--color-surface)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ordenacao !== 'name' ? 'var(--color-accent)' : 'var(--color-text-sec)',
          }}
        >
          <Icon
            name="list"
            size={20}
            stroke={2}
            color={ordenacao !== 'name' ? 'var(--color-accent)' : 'var(--color-text-sec)'}
          />
        </button>
      </div>

      {/* ---- Chips de condomínio ---- */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          padding: '0 20px 4px',
          scrollbarWidth: 'none',
        }}
      >
        {[{ id: null, name: 'Todos' }, ...condominios].map((condo) => {
          const isAtivo = filtroCondominio === condo.id
          return (
            <button
              key={condo.id ?? '__todos__'}
              onClick={() => setFiltroCondominio(condo.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                border: isAtivo ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                background: isAtivo ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                color: isAtivo ? 'var(--color-accent)' : 'var(--color-text-sec)',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {condo.name}
            </button>
          )
        })}
      </div>

      {/* ---- Chips de status ---- */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '6px 20px 4px',
          scrollbarWidth: 'none',
        }}
      >
        {STATUS_OPCOES.map((opt) => {
          const isAtivo = statusFiltro === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setStatusFiltro(opt.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                border: isAtivo ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border-2)',
                background: isAtivo ? 'var(--color-gold-soft)' : 'transparent',
                color: isAtivo ? 'var(--color-accent)' : 'var(--color-text-ter)',
                minHeight: 36,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* ---- Lista de clientes ---- */}
      <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : clientes.length === 0 ? (
          /* Empty state */
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 8px',
              }}
            >
              Nenhum cliente encontrado
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text-sec)',
                margin: 0,
              }}
            >
              {debouncedQ.trim()
                ? 'Tente outro termo de busca.'
                : 'Ajuste os filtros para ver mais clientes.'}
            </p>
          </div>
        ) : (
          <>
            {clientes.map((c) => {
              const condoNome = nomeCondominio(c.condominiumId)
              const ultimaCompra = c.lastPurchaseAt
                ? `últ. ${formatDataCurta(c.lastPurchaseAt)}`
                : 'sem compras'
              const linhaSecundaria = `${condoNome} · ${c.apartment}${c.block ? ` bl ${c.block}` : ''} · ${ultimaCompra}`

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id)
                    setSub('detalhe')
                  }}
                  role="button"
                  aria-label={`Ver detalhes de ${c.name}`}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 18,
                    border: '1px solid var(--color-border-2)',
                    padding: 14,
                    cursor: 'pointer',
                    opacity: c.isBlocked ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'var(--color-surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--color-accent)',
                    }}
                  >
                    <Icon name="user" size={22} stroke={1.9} color="var(--color-accent)" />
                  </div>

                  {/* Textos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                        }}
                      >
                        {c.name}
                      </span>
                      {c.isBlocked && <Icon name="ban" size={14} stroke={1.9} color="var(--color-accent)" />}
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--color-text-ter)',
                        margin: '2px 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {linhaSecundaria}
                    </p>
                  </div>

                  {/* Saldo */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        fontWeight: 800,
                        color: c.creditBalance > 0 ? 'var(--color-text)' : 'var(--color-text-ter)',
                        lineHeight: 1,
                      }}
                    >
                      {c.creditBalance}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 10.5,
                        color: 'var(--color-text-ter)',
                        marginTop: 2,
                      }}
                    >
                      créditos
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Carregar mais */}
            {hasMore && (
              <button
                onClick={() => { void loadMore() }}
                disabled={isLoadingMore}
                style={{
                  marginTop: 4,
                  width: '100%',
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
                {isLoadingMore ? 'Carregando…' : `Carregar mais (${total - clientes.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ---- Bottom sheet de ordenação ---- */}
      {showSortSheet && (
        <>
          <div
            onClick={() => setShowSortSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sort-sheet-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--color-app-bg)',
              borderRadius: '20px 20px 0 0',
              padding: `24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`,
              maxHeight: '80vh',
              overflowY: 'auto',
              zIndex: 51,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-border)', margin: '0 auto 20px' }} />
            <h2
              id="sort-sheet-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 19,
                color: 'var(--color-text)',
                margin: '0 0 16px',
                letterSpacing: '-0.01em',
              }}
            >
              Ordenar por
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SORT_OPCOES.map((opt) => {
                const isAtivo = ordenacao === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setOrdenacao(opt.id)
                      setShowSortSheet(false)
                    }}
                    aria-pressed={isAtivo}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      minHeight: 48,
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: isAtivo ? 'var(--color-gold-soft)' : 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: isAtivo ? 'var(--color-accent)' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                    {isAtivo && <Icon name="check" size={18} stroke={2.2} color="var(--color-accent)" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
