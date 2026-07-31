import { formatCredits, toMilli } from '@cheirin-de-pao/shared'
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { FilterChips } from '../../../components/admin/FilterChips'

/**
 * MarketCestinhas — lista e detalhe dos pedidos do mini market na visão do admin.
 *
 * Até esta tela o admin não tinha NENHUMA forma de abrir, auditar ou reverter uma Cestinha: o
 * módulo do mercadinho só cuidava de produtos, categorias e config. A verificação geral da operação
 * vive no ledger unificado (aba Entregas); aqui é a visão do mercadinho — itens com preço, split
 * crédito×dinheiro, pagamento e o cancelamento administrativo (sem gate de corte).
 */

interface OrderItem {
  productId: string
  name: string
  qty: number
  unitPrice: number
}

interface MarketOrderRow {
  id: string
  userId: string
  clientName: string
  clientPhone: string
  block: string
  apartment: string
  condominiumId: string
  condominiumName: string
  slotId: string
  slotLabel: string
  deliveryTime: string
  status: string
  scheduledDate: string
  breadQty: number
  items: OrderItem[]
  itemCount: number
  totalValue: number
  creditsApplied: number
  moneyAmount: number
  courierId: string
  courierName: string
  paymentId: string
  paymentStatus: string
  paymentMethod: string
  separatedAt: string
  deliveredAt: string
  failedAt: string
  failureReason: string
  cancelledAt: string
  cancelReason: string
  createdAt: string
  refundedCredits: number
  cancelable: boolean
  // Desfecho físico de uma entrega que falhou (G2).
  lossResolvedAt?: string
  stockReturned?: boolean | null
  lossReason?: string
  /** NOT_DELIVERED sem desfecho — é a pendência que a Onda G2 tirou do silêncio. */
  lossPending?: boolean
}

const STATUS_META: Record<string, { label: string; color: string; soft: string }> = {
  PENDING_PAYMENT: { label: 'Aguardando pagamento', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  SCHEDULED: { label: 'Agendada', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  SEPARATED: { label: 'Separada', color: 'var(--color-accent)', soft: 'var(--color-surface-2)' },
  OUT_FOR_DELIVERY: { label: 'A caminho', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  DELIVERED: { label: 'Entregue', color: 'var(--color-good)', soft: 'var(--color-good-soft)' },
  NOT_DELIVERED: { label: 'Não entregue', color: '#B4541F', soft: '#F8E7DA' },
  CANCELLED: { label: 'Cancelada', color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' },
}

type Filter = 'abertas' | 'todas' | 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED'

const FILTERS: { key: Filter; label: string; status?: string }[] = [
  // "Abertas" = o que ainda vai acontecer (é onde o admin age).
  { key: 'abertas', label: 'Abertas', status: 'PENDING_PAYMENT,SCHEDULED,SEPARATED,OUT_FOR_DELIVERY' },
  { key: 'todas', label: 'Todas' },
  { key: 'DELIVERED', label: 'Entregues', status: 'DELIVERED' },
  // G2: a entrega que falhou tem desfecho a resolver (estoque e crédito) e precisava de um lugar.
  { key: 'NOT_DELIVERED', label: 'Não entregues', status: 'NOT_DELIVERED' },
  { key: 'CANCELLED', label: 'Canceladas', status: 'CANCELLED' },
]

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

export function MarketCestinhas() {
  const [rows, setRows] = useState<MarketOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<Filter>('abertas')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MarketOrderRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      const f = FILTERS.find((x) => x.key === filter)
      if (f?.status) params.status = f.status
      if (search.trim()) params.q = search.trim()
      const r = await apiFetch(`/admin/market/orders?${new URLSearchParams(params).toString()}`)
      if (r.ok) {
        const data = (await r.json()) as { rows: MarketOrderRow[]; total: number }
        setRows(data.rows)
        setTotal(data.total)
      }
    } catch {
      /* falha silenciosa — mesmo padrão das outras telas do hub */
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div style={{ padding: '4px 20px 28px' }}>
      {/* Filtros — nível 2, subordinado às abas de seção do hub (ver FilterChips). */}
      <FilterChips chips={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filtrar Cestinhas por situação" />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por cliente ou apartamento"
        style={{
          width: '100%',
          minHeight: 40,
          borderRadius: 12,
          border: '1px solid var(--color-border-2)',
          background: 'var(--color-surface-2)',
          padding: '0 13px',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--color-text)',
          marginBottom: 12,
        }}
      />

      {loading ? (
        <p style={{ textAlign: 'center', paddingTop: 24, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
          Carregando...
        </p>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: 'center', paddingTop: 24, fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)' }}>
          Nenhuma Cestinha {filter === 'abertas' ? 'em aberto' : 'encontrada'}.
        </p>
      ) : (
        <>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-ter)', margin: '0 0 8px' }}>
            {total} {total === 1 ? 'Cestinha' : 'Cestinhas'}
            {rows.length < total ? ` · mostrando ${rows.length}` : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((o) => (
              <OrderCard key={o.id} order={o} onOpen={() => setSelected(o)} />
            ))}
          </div>
        </>
      )}

      {selected && (
        <OrderSheet
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function OrderCard({ order: o, onOpen }: { order: MarketOrderRow; onOpen: () => void }) {
  const meta = STATUS_META[o.status] ?? { label: o.status, color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' }
  const loc = [o.block && `Bl ${o.block}`, `Apto ${o.apartment || '—'}`].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 14,
        padding: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--color-gold-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name="basket" size={19} color="var(--color-accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {o.clientName}
          </p>
          <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 99, background: meta.soft, color: meta.color, fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700 }}>
            {/* G2: a pendência é mais urgente que o status — sem isso a perda ficava invisível. */}
            {o.lossPending ? 'Resolver perda' : meta.label}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
          {o.condominiumName} · {loc} · {fmtDate(o.scheduledDate)} {o.slotLabel}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          {o.items.map((it) => (
            <span
              key={it.productId}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-sec)',
                whiteSpace: 'nowrap',
              }}
            >
              {it.qty}× {it.name}
            </span>
          ))}
          {/* D-1: o pão da Cestinha é PÃO — chip próprio, nunca somado à contagem de itens. */}
          {o.breadQty > 0 && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--color-gold-soft)',
                color: 'var(--color-accent)',
                whiteSpace: 'nowrap',
              }}
            >
              {o.breadQty} 🥖
            </span>
          )}
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '5px 0 0' }}>
          {[o.creditsApplied > 0 ? `${formatCredits(toMilli(o.creditsApplied))} 🥖` : '', o.moneyAmount > 0 ? fmtMoney(o.moneyAmount) : '']
            .filter(Boolean)
            .join(' + ') || fmtMoney(o.totalValue)}
          {o.refundedCredits > 0 ? ` · estornado ${formatCredits(toMilli(o.refundedCredits))} 🥖` : ''}
        </p>
      </div>
      <Icon name="chevR" size={16} color="var(--color-text-ter)" stroke={2.2} />
    </button>
  )
}

function OrderSheet({
  order: o,
  onClose,
  onChanged,
}: {
  order: MarketOrderRow
  onClose: () => void
  onChanged: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  /** G2 — desfecho de perda: fluxo próprio, porque não é cancelamento (a entrega falhou de fato). */
  const [resolvingLoss, setResolvingLoss] = useState(false)
  const [reason, setReason] = useState('')
  const [refundCredits, setRefundCredits] = useState(true)
  // Em perda o default é NÃO devolver estoque: o produto saiu para a rua e pode ter se perdido —
  // devolver por omissão inflaria o inventário (mesma razão da decisão 4 da Onda B).
  const [returnStock, setReturnStock] = useState(true)
  const [lossReturnStock, setLossReturnStock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const meta = STATUS_META[o.status] ?? { label: o.status, color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' }

  async function cancel() {
    setBusy(true)
    setError('')
    try {
      const r = await apiFetch(`/admin/market/orders/${o.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || undefined, refundCredits, returnStock }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Falha ao cancelar')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  async function resolveLoss() {
    setBusy(true)
    setError('')
    try {
      const r = await apiFetch(`/admin/market/orders/${o.id}/resolve-loss`, {
        method: 'POST',
        body: JSON.stringify({ returnStock: lossReturnStock, refundCredits, reason: reason.trim() || undefined }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Falha ao resolver')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--color-app-bg)',
          borderRadius: '20px 20px 0 0',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '88dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
              🧺 {o.clientName}
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
              {o.condominiumName} · {o.block ? `Bl ${o.block} · ` : ''}Apto {o.apartment || '—'}
              {o.clientPhone ? ` · ${o.clientPhone}` : ''}
            </p>
          </div>
          <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 99, background: meta.soft, color: meta.color, fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700 }}>
            {meta.label}
          </span>
        </div>

        {/* Itens com preço — é o que o admin confere antes de decidir */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 14, padding: 12, marginBottom: 12 }}>
          {o.items.map((it) => (
            <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)' }}>
                {it.qty}× {it.name}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                {fmtMoney(it.qty * it.unitPrice)}
              </span>
            </div>
          ))}
          {o.breadQty > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-accent)', fontWeight: 700 }}>
                {o.breadQty} pães 🥖
              </span>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--color-border-2)', marginTop: 7, paddingTop: 7, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-sec)' }}>Total</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>{fmtMoney(o.totalValue)}</span>
          </div>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 14, padding: '4px 12px', marginBottom: 14 }}>
          <Row label="Entrega" value={`${fmtDate(o.scheduledDate)} · ${o.slotLabel}${o.deliveryTime ? ` (${o.deliveryTime})` : ''}`} />
          <Row
            label="Pago"
            value={
              [o.creditsApplied > 0 ? `${formatCredits(toMilli(o.creditsApplied))} 🥖` : '', o.moneyAmount > 0 ? fmtMoney(o.moneyAmount) : '']
                .filter(Boolean)
                .join(' + ') || '—'
            }
          />
          {o.paymentId && <Row label="Pagamento" value={`${o.paymentMethod || '—'} · ${o.paymentStatus || '—'}`} />}
          {o.courierName && <Row label="Entregador" value={o.courierName} />}
          {o.separatedAt && <Row label="Separada" value={fmtDateTime(o.separatedAt)} />}
          {o.deliveredAt && <Row label="Entregue" value={fmtDateTime(o.deliveredAt)} />}
          {o.failedAt && <Row label="Não entregue" value={`${fmtDateTime(o.failedAt)}${o.failureReason ? ` · ${o.failureReason}` : ''}`} />}
          {o.cancelledAt && <Row label="Cancelada" value={`${fmtDateTime(o.cancelledAt)}${o.cancelReason ? ` · ${o.cancelReason}` : ''}`} />}
          {o.refundedCredits > 0 && <Row label="Estornado" value={`${formatCredits(toMilli(o.refundedCredits))} 🥖`} />}
          <Row label="Criada" value={fmtDateTime(o.createdAt)} />
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#C2410C', margin: '0 0 12px' }}>{error}</p>
        )}

        {/* G2 — a única saída de uma Cestinha não entregue. Antes desta onda, o NOT_DELIVERED era
            terminal: saía do radar de "parados" e o "resolver" de Entregas a recusava com 422, então
            o estoque e o crédito ficavam presos e o prejuízo virava silêncio. */}
        {o.lossPending && !resolvingLoss && !confirming && (
          <>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)', margin: '0 0 10px', lineHeight: 1.45 }}>
              Esta entrega falhou e ainda não tem desfecho: os produtos voltaram para a prateleira? o
              cliente recebe os pãezinhos de volta?
            </p>
            <button
              type="button"
              onClick={() => setResolvingLoss(true)}
              style={{
                width: '100%',
                minHeight: 46,
                borderRadius: 13,
                border: 'none',
                background: 'var(--color-espresso)',
                color: '#FAF5EC',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 14.5,
                cursor: 'pointer',
              }}
            >
              Resolver perda
            </button>
          </>
        )}

        {resolvingLoss && (
          <div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="O que aconteceu? (perdido, avariado, devolvido…)"
              rows={2}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--color-border-2)',
                background: 'var(--color-surface-2)',
                padding: 11,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text)',
                resize: 'vertical',
                marginBottom: 10,
              }}
            />
            <Check label="Devolver os pãezinhos ao cliente" checked={refundCredits} onChange={setRefundCredits} />
            <Check
              label="Os produtos voltaram ao estoque"
              checked={lossReturnStock}
              onChange={setLossReturnStock}
            />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '2px 0 0', lineHeight: 1.4 }}>
              Marque só se os itens realmente voltaram para a prateleira. A vaga do dia não é
              liberada — aquele dia já fechou.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setResolvingLoss(false)}
                disabled={busy}
                style={{ flex: 1, minHeight: 44, borderRadius: 13, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void resolveLoss()}
                disabled={busy}
                style={{ flex: 1, minHeight: 44, borderRadius: 13, border: 'none', background: 'var(--color-espresso)', color: '#FAF5EC', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Salvando...' : 'Confirmar desfecho'}
              </button>
            </div>
          </div>
        )}

        {o.cancelable && !confirming && !resolvingLoss && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              width: '100%',
              minHeight: 46,
              borderRadius: 13,
              border: '1.5px solid #E2B4A0',
              background: 'transparent',
              color: '#B4541F',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 14.5,
              cursor: 'pointer',
            }}
          >
            Cancelar Cestinha
          </button>
        )}

        {confirming && (
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: '0 0 10px' }}>
              O cliente recebe de volta em pãezinhos — inclusive a parte paga em dinheiro, convertida.
              Não há estorno no cartão/Pix.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo do cancelamento (auditoria)"
              rows={2}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--color-border-2)',
                background: 'var(--color-surface-2)',
                padding: 11,
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text)',
                resize: 'vertical',
                marginBottom: 10,
              }}
            />
            <Check label="Devolver os pãezinhos ao cliente" checked={refundCredits} onChange={setRefundCredits} />
            <Check label="Devolver os produtos ao estoque" checked={returnStock} onChange={setReturnStock} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                style={{ flex: 1, minHeight: 44, borderRadius: 13, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={busy}
                style={{ flex: 1, minHeight: 44, borderRadius: 13, border: 'none', background: '#B4541F', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {!o.cancelable && !confirming && !resolvingLoss && !o.lossPending && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', textAlign: 'center', margin: 0 }}>
            {o.status === 'DELIVERED'
              ? 'Entregue — para reverter, use "resolver" na aba Entregas.'
              : o.status === 'NOT_DELIVERED' && o.lossResolvedAt
                ? `Perda resolvida em ${fmtDateTime(o.lossResolvedAt)} · ${o.stockReturned ? 'produtos devolvidos ao estoque' : 'produtos NÃO voltaram (perda)'}${o.lossReason ? ` · ${o.lossReason}` : ''}`
                : 'Cestinha já encerrada.'}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-border-2)' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--color-espresso)' }}
      />
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text)' }}>{label}</span>
    </label>
  )
}
