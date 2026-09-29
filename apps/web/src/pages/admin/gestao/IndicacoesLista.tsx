import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import type { ReferralStateKey } from '../../../lib/referral'
import { Icon } from '../../../components/brand/Icon'
import { RefCard, RefSkel, RF_BODY } from '../../../components/client/referral/RefPrimitives'
import { RaBtn, RaChips, RaInline, RaSignal, RaStatePill, brtDay, type RaChip } from '../../../components/admin/referral/RaKit'
import { IndicacaoDetalheSheet } from './IndicacaoDetalheSheet'

type Filter = 'analise' | 'aguardando' | 'ganhou' | 'recusada' | 'expirou' | 'todas'

interface ListItem {
  id: string
  state: ReferralStateKey
  referrer: { id: string; name: string }
  referred: { id: string; name: string }
  createdAt: string
  condo: string | null
  signals: string[]
}

interface ListResponse {
  items: ListItem[]
  counts: Record<Filter, number>
  total: number
  page: number
  pageSize: number
}

/** "Nenhuma indicação em análise no momento." — o complemento de cada chip. */
const EMPTY_SUFFIX: Record<Filter, string> = {
  analise: ' em análise',
  aguardando: ' aguardando',
  ganhou: ' recompensada',
  recusada: ' recusada',
  expirou: ' expirada',
  todas: '',
}

/**
 * A4 — Lista de indicações (handoff `RAList`). "Em análise" vem primeiro, com contagem, e os cards
 * dela ganham borda dourada. Tocar num card abre o detalhe (sheet).
 */
export function IndicacoesLista({ onChanged }: { onChanged?: () => void }) {
  const [filter, setFilter] = useState<Filter>('analise')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Busca com espera curta: não dispara uma consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    const first = page === 1
    if (first) setLoading(true)
    else setLoadingMore(true)
    void (async () => {
      try {
        const params = new URLSearchParams({ state: filter, page: String(page) })
        if (q) params.set('q', q)
        const res = await apiFetch(`/admin/referrals?${params.toString()}`)
        if (!res.ok) throw new Error('falha')
        const body = (await res.json()) as ListResponse
        if (cancelled) return
        setData(body)
        setItems((prev) => (first ? body.items : [...prev, ...body.items]))
        setError(false)
      } catch {
        if (!cancelled && first) setError(true)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filter, q, page, reloadKey])

  const changeFilter = (f: Filter) => {
    setFilter(f)
    setPage(1)
  }

  const counts = data?.counts
  const chips: RaChip<Filter>[] = [
    { key: 'analise', label: 'Em análise', count: counts?.analise },
    { key: 'aguardando', label: 'Aguardando' },
    { key: 'ganhou', label: 'Recompensadas' },
    { key: 'recusada', label: 'Recusadas' },
    { key: 'expirou', label: 'Expiradas' },
    { key: 'todas', label: 'Todas' },
  ]

  return (
    <div style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <RaChips items={chips} value={filter} onChange={changeFilter} ariaLabel="Filtrar indicações por estado" />

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 14,
          padding: '12px 14px',
        }}
      >
        <Icon name="search" size={18} color="var(--color-text-ter)" stroke={2} />
        <input
          type="search"
          aria-label="Buscar indicação por nome"
          placeholder="Buscar por nome"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            setPage(1)
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            color: 'var(--color-text)',
            fontFamily: RF_BODY,
            fontWeight: 500,
          }}
        />
      </label>

      {loading ? (
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <RefSkel key={i} h={92} r={20} />
          ))}
        </div>
      ) : error ? (
        <>
          <RaInline>Não conseguimos carregar as indicações.</RaInline>
          <RaBtn variant="soft" icon="refresh" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar de novo
          </RaBtn>
        </>
      ) : items.length === 0 ? (
        <RefCard
          pad={24}
          style={{ textAlign: 'center', boxShadow: 'none', background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border)' }}
        >
          <Icon name="list" size={26} color="var(--color-text-ter)" />
          <div style={{ fontFamily: RF_BODY, fontWeight: 800, fontSize: 15, color: 'var(--color-text)', marginTop: 8 }}>Nada por aqui</div>
          <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', marginTop: 4 }}>
            {q ? `Nenhuma indicação${EMPTY_SUFFIX[filter]} com “${q}”.` : `Nenhuma indicação${EMPTY_SUFFIX[filter]} no momento.`}
          </div>
        </RefCard>
      ) : (
        <>
          {items.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenId(r.id)}
              aria-label={`${r.referrer.name} indicou ${r.referred.name} — abrir detalhe`}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                background: 'var(--color-surface)',
                borderRadius: 22,
                border: r.state === 'analise' ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border-2)',
                boxShadow: 'var(--shadow-soft)',
                padding: 14,
                fontFamily: RF_BODY,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', lineHeight: 1.3 }}>
                  {r.referrer.name} <span style={{ color: 'var(--color-accent)' }}>→</span> {r.referred.name}
                </div>
                <Icon name="chevR" size={17} color="var(--color-text-ter)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <RaStatePill state={r.state} />
                <span style={{ fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 600 }}>
                  {[brtDay(r.createdAt), r.condo].filter(Boolean).join(' · ')}
                </span>
              </div>
              {r.signals.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                  {r.signals.map((s) => (
                    <RaSignal key={s}>{s}</RaSignal>
                  ))}
                </div>
              )}
            </button>
          ))}
          {data && items.length < data.total && (
            <RaBtn variant="ghost" full disabled={loadingMore} onClick={() => setPage((p) => p + 1)}>
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </RaBtn>
          )}
        </>
      )}

      {openId && (
        <IndicacaoDetalheSheet
          id={openId}
          onClose={() => setOpenId(null)}
          onDecided={() => {
            setPage(1)
            setReloadKey((k) => k + 1)
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}
