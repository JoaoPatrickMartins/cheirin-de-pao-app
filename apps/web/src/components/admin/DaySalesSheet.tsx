import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

/**
 * DaySalesSheet — "o que eu vendi para este dia até agora", geral.
 *
 * Abre da tela do dia na aba Pedidos. O resto daquela tela é por condomínio (é o que a compra e a
 * separação precisam); esta é a única visão que responde "quantos bolos saíram hoje" sem obrigar
 * ninguém a somar condomínio por condomínio na mão.
 *
 * Espelha `GET /admin/day-sales` — os números NÃO são recalculados aqui. O total de pães precisa
 * bater com o card do dia, e duas implementações da mesma regra sempre divergem na primeira
 * mudança.
 */

interface SlotQty {
  slotId: string
  label: string
  qty: number
}

interface SalesLine {
  productId: string
  name: string
  isBread: boolean
  qty: number
  revenue: number
  avgUnitPrice: number
  bySlot: SlotQty[]
}

export interface DaySales {
  date: string
  generatedAt: string
  breads: {
    total: number
    single: number
    scheduled: number
    fromMarket: number
    fromItems: number
    unitPrice: number
    revenue: number
  }
  items: { total: number; revenue: number }
  totalRevenue: number
  cash: { money: number; creditsMilli: number }
  counts: { stops: number; clients: number; condominiums: number; breadOrders: number; marketOrders: number }
  slots: Array<{ slotId: string; label: string; breads: number; items: number; revenue: number }>
  lines: SalesLine[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBrl(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "2026-06-28" → "sábado, 28 de junho". */
function formatDayLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`)
  const full = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
  return full.charAt(0).toUpperCase() + full.slice(1)
}

/** ISO → "14:32" (BRT) — o "até o momento" do título. */
function formatHour(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function slotColor(slotId: string): string {
  if (slotId === 'manha') return 'var(--color-gold)'
  if (slotId === 'tarde') return 'var(--color-accent)'
  return 'var(--color-text-sec)'
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 4px', minWidth: 0 }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          color: color ?? 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-ter)',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border-2)', margin: '1px 0' }} />
}

function DownloadButton({
  label,
  icon,
  busy,
  onClick,
}: {
  label: string
  icon: 'doc' | 'download'
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        flex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid var(--color-border-2)',
        background: 'var(--color-surface)',
        fontFamily: 'var(--font-body)',
        fontSize: 13.5,
        fontWeight: 700,
        color: 'var(--color-text)',
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.6 : 1,
        minHeight: 44,
      }}
    >
      <Icon name={icon} size={16} color="var(--color-accent)" stroke={2} />
      {label}
    </button>
  )
}

/** Uma linha de produto: nome + quebra por turno à esquerda, quantidade e R$ à direita. */
function ProductRow({ line, showSlots }: { line: SalesLine; showSlots: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '9px 0',
        borderTop: '1px solid var(--color-border-2)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: line.isBread ? 800 : 600,
            color: 'var(--color-text)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {line.isBread ? '🥖 ' : ''}
          {line.name}
        </p>
        {showSlots && line.bySlot.length > 1 && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-text-ter)',
              margin: '2px 0 0',
              display: 'flex',
              gap: 9,
              flexWrap: 'wrap',
            }}
          >
            {line.bySlot.map((s) => (
              <span key={s.slotId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <i style={{ width: 7, height: 7, borderRadius: 2, background: slotColor(s.slotId) }} />
                {s.label} {s.qty}
              </span>
            ))}
          </p>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {line.qty}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-ter)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 1,
          }}
        >
          {formatBrl(line.revenue)}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface Props {
  /** Dia de entrega (YYYY-MM-DD). */
  date: string
  onClose: () => void
}

export function DaySalesSheet({ date, onClose }: Props) {
  const [report, setReport] = useState<DaySales | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/admin/day-sales?date=${date}`)
        if (cancelled) return
        if (res.ok) setReport((await res.json()) as DaySales)
        else setFailed(true)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  // Esc fecha — o sheet cobre a tela inteira e o toque fora nem sempre está à mão no desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function download(type: 'pdf' | 'excel') {
    setDownloading(type)
    try {
      const res = await apiFetch(`/admin/day-sales/${type}?date=${date}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vendas-${date}.${type === 'pdf' ? 'pdf' : 'xlsx'}`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // falha silenciosa — o relatório na tela continua válido
    } finally {
      setDownloading(null)
    }
  }

  const hasSales = !!report && (report.breads.total > 0 || report.items.total > 0)
  const origens = report
    ? [
        report.breads.single > 0 ? `avulso ${report.breads.single}` : '',
        report.breads.scheduled > 0 ? `agenda ${report.breads.scheduled}` : '',
        report.breads.fromMarket > 0 ? `Cestinha ${report.breads.fromMarket}` : '',
      ].filter(Boolean)
    : []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Relatório de itens vendidos do dia"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
          width: '100%',
          maxWidth: 480,
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
              Itens vendidos
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '3px 0 0' }}>
              {formatDayLong(date)}
              {report ? ` · até ${formatHour(report.generatedAt)}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={16} color="var(--color-text-sec)" stroke={2.2} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : failed || !report ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', textAlign: 'center', padding: '28px 0' }}>
            Não foi possível carregar o relatório. Tente de novo.
          </p>
        ) : !hasSales ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', textAlign: 'center', padding: '28px 0' }}>
            Nenhuma venda para este dia até o momento.
          </p>
        ) : (
          <>
            {/* KPIs */}
            <div
              style={{
                background: 'var(--color-app-bg)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 16,
                padding: '13px 8px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <Stat label="Pães" value={`${report.breads.total}`} />
                <Divider />
                <Stat label="Itens" value={`${report.items.total}`} color="var(--color-accent)" />
                <Divider />
                <Stat label="Total" value={formatBrl(report.totalRevenue)} />
              </div>
              {origens.length > 0 && (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    color: 'var(--color-text-ter)',
                    textAlign: 'center',
                    margin: '10px 0 0',
                  }}
                >
                  Pães por origem: {origens.join(' · ')}
                </p>
              )}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--color-text-ter)',
                  textAlign: 'center',
                  margin: '4px 0 0',
                }}
              >
                {report.counts.stops} {report.counts.stops === 1 ? 'parada' : 'paradas'} ·{' '}
                {report.counts.clients} {report.counts.clients === 1 ? 'cliente' : 'clientes'} ·{' '}
                {report.counts.condominiums} {report.counts.condominiums === 1 ? 'condomínio' : 'condomínios'}
              </p>
            </div>

            {/* Linhas por produto */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11.5,
                fontWeight: 800,
                letterSpacing: '0.05em',
                color: 'var(--color-text-sec)',
                margin: '4px 2px 2px',
              }}
            >
              POR PRODUTO
            </p>
            <div style={{ marginBottom: 14 }}>
              {report.lines.map((line) => (
                <ProductRow key={line.productId} line={line} showSlots={report.slots.length > 1} />
              ))}
            </div>

            {/* Por turno */}
            {report.slots.length > 1 && (
              <>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-sec)',
                    margin: '4px 2px 8px',
                  }}
                >
                  POR TURNO
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                  {report.slots.map((s) => (
                    <div
                      key={s.slotId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        background: 'var(--color-app-bg)',
                        borderRadius: 12,
                        padding: '9px 12px',
                        fontFamily: 'var(--font-body)',
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, color: 'var(--color-text)' }}>
                        <i style={{ width: 9, height: 9, borderRadius: 3, background: slotColor(s.slotId) }} />
                        {s.label}
                      </span>
                      <span style={{ color: 'var(--color-text-sec)', fontVariantNumeric: 'tabular-nums' }}>
                        {s.breads} 🥖 · {s.items} 🧺 · {formatBrl(s.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Caixa + ressalva. Sem isto o total vira "faturamento do dia" na cabeça de quem lê:
                o pão da agenda foi pago em pãezinhos comprados semanas antes, num combo. */}
            <div
              style={{
                borderTop: '1px solid var(--color-border-2)',
                paddingTop: 11,
                marginBottom: 14,
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                color: 'var(--color-text-ter)',
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: 0 }}>
                Recebido na Cestinha: <strong style={{ color: 'var(--color-text-sec)' }}>{formatBrl(report.cash.money)}</strong> em
                dinheiro + <strong style={{ color: 'var(--color-text-sec)' }}>{(report.cash.creditsMilli / 1000).toFixed(1)}</strong> 🥖 em
                crédito.
              </p>
              <p style={{ margin: '4px 0 0' }}>
                Pães valorizados a {formatBrl(report.breads.unitPrice)} (preço do avulso) — o pão da agenda foi pago em
                pãezinhos de combo, em outra data. O relatório conta o que foi vendido para este dia, não o que foi entregue.
              </p>
            </div>

            {/* Downloads */}
            <div style={{ display: 'flex', gap: 9 }}>
              <DownloadButton label="PDF" icon="doc" busy={downloading === 'pdf'} onClick={() => void download('pdf')} />
              <DownloadButton
                label="Excel"
                icon="download"
                busy={downloading === 'excel'}
                onClick={() => void download('excel')}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
