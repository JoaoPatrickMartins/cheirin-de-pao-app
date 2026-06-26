import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

// ---------------------------------------------------------------------------
// Tipos (espelham GET /admin/supplier-orders/draft/:condominiumId)
// ---------------------------------------------------------------------------

type RiskFlag = '' | 'no-credit' | 'blocked'

interface DeliveryDetail {
  userId: string
  name: string
  apartment: string
  block: string
  quantity: number
  slotId: string
  slotLabel: string
  type: 'SINGLE' | 'SCHEDULED'
  source: 'order' | 'projected'
  risk: RiskFlag
}

interface SlotBreakdown {
  slotId: string
  label: string
  breads: number
  deliveries: number
}

interface CondoDetail {
  condominiumId: string
  name: string
  totalBreads: number
  materializedBreads: number
  projectedBreads: number
  deliveryCount: number
  projectedDeliveries: number
  riskCount: number
  bySlot: SlotBreakdown[]
  byType: { single: number; scheduled: number }
  deliveries: DeliveryDetail[]
}

interface Props {
  condominiumId: string
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Tom de atenção dentro da família quente do app (terracota) — separa "risco"
// do dourado usado em "previsto"/"manhã", para leitura semântica imediata.
const WARN = '#B4541F'
const WARN_SOFT = '#F8E7DA'

function slotColor(slotId: string): string {
  if (slotId === 'manha') return 'var(--color-gold)'
  if (slotId === 'tarde') return 'var(--color-accent)'
  return 'var(--color-text-sec)'
}

/** Rótulo do bloco sem duplicar a palavra "Bloco" (o valor já pode contê-la). */
function blockLabel(block: string): string {
  if (block === '—') return 'Sem bloco'
  return /^bloco\b/i.test(block.trim()) ? block.trim() : `Bloco ${block}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (a + b).toUpperCase() || '·'
}

function riskLabel(risk: RiskFlag): string | null {
  if (risk === 'no-credit') return 'Sem crédito'
  if (risk === 'blocked') return 'Bloqueado'
  return null
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CondominiumOrderDetail({ condominiumId, onBack }: Props) {
  const [data, setData] = useState<CondoDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [slotFilter, setSlotFilter] = useState<string>('all')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    apiFetch(`/admin/supplier-orders/draft/${condominiumId}`)
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json()) as CondoDetail
        if (active) setData(json)
      })
      .catch(() => {
        /* falha silenciosa */
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [condominiumId])

  // Entregas filtradas pelo turno selecionado
  const visible = useMemo(() => {
    if (!data) return []
    return slotFilter === 'all' ? data.deliveries : data.deliveries.filter((d) => d.slotId === slotFilter)
  }, [data, slotFilter])

  // Agrupar por bloco (preservando a ordem já vinda do backend)
  const groups = useMemo(() => {
    const map = new Map<string, DeliveryDetail[]>()
    for (const d of visible) {
      const key = d.block || '—'
      const list = map.get(key) ?? []
      list.push(d)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [visible])

  function exportCsv() {
    if (!data) return
    const header = ['Cliente', 'Bloco', 'Apartamento', 'Turno', 'Tipo', 'Origem', 'Risco', 'Quantidade']
    const linhas = data.deliveries.map((d) => [
      d.name,
      d.block,
      d.apartment,
      d.slotLabel,
      d.type === 'SINGLE' ? 'Avulso' : 'Agenda',
      d.source === 'projected' ? 'Previsto' : 'Confirmado',
      riskLabel(d.risk) ?? '',
      String(d.quantity),
    ])
    const csv = [header, ...linhas]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedido-${slugify(data.name)}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
          borderBottom: '1px solid var(--color-border-2)',
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data?.name ?? 'Condomínio'}
          </h2>
          {data && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11.5,
                color: 'var(--color-text-ter)',
                fontWeight: 600,
                margin: '1px 0 0',
              }}
            >
              {data.deliveryCount} confirmadas
              {data.projectedDeliveries > 0 ? ` · ${data.projectedDeliveries} previstas` : ''}
            </p>
          )}
        </div>
        {data && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'flex-end',
                gap: 4,
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                color: 'var(--color-text)',
              }}
            >
              {data.totalBreads}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                pães
              </span>
            </span>
            {data.projectedBreads > 0 && (
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)',
                  fontSize: 10.5,
                  color: 'var(--color-accent)',
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                +{data.projectedBreads} previstos
              </span>
            )}
          </div>
        )}
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
      ) : !data || data.deliveries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>
            Sem entregas
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: 0 }}>
            Nenhuma entrega confirmada ou prevista para amanhã.
          </p>
        </div>
      ) : (
        <>
          {/* Resumo coeso: confirmados / previstos / em risco + split de turno */}
          <div
            style={{
              margin: '14px 20px 12px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-2)',
              borderRadius: 16,
              padding: '13px 8px 6px',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <Stat label="Confirmados" value={data.materializedBreads} color="var(--color-text)" />
              <Divider />
              <Stat label="Previstos" value={data.projectedBreads} color="var(--color-accent)" />
              <Divider />
              <Stat label="Em risco" value={data.riskCount} color={data.riskCount > 0 ? WARN : 'var(--color-text)'} />
            </div>

            {data.bySlot.length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border-2)', margin: '10px 6px 0', paddingTop: 11 }}>
                {data.bySlot.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      height: 7,
                      borderRadius: 8,
                      overflow: 'hidden',
                      marginBottom: 9,
                      boxShadow: 'inset 0 0 0 1px var(--color-border-2)',
                    }}
                  >
                    {data.bySlot.map((s) => (
                      <div
                        key={s.slotId}
                        style={{ width: `${(s.breads / data.totalBreads) * 100}%`, background: slotColor(s.slotId) }}
                      />
                    ))}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--color-text-sec)',
                  }}
                >
                  {data.bySlot.map((s) => (
                    <span key={s.slotId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i style={{ width: 9, height: 9, borderRadius: 3, background: slotColor(s.slotId) }} />
                      {s.label}
                      <strong style={{ color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{s.breads}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs de turno */}
          {data.bySlot.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px' }}>
              {[{ slotId: 'all', label: 'Todos' }, ...data.bySlot].map((t) => {
                const on = slotFilter === t.slotId
                return (
                  <button
                    key={t.slotId}
                    onClick={() => setSlotFilter(t.slotId)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'var(--font-body)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: on ? '#fff' : 'var(--color-text-sec)',
                      padding: 8,
                      borderRadius: 11,
                      background: on ? 'var(--color-accent)' : 'var(--color-surface-2)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Lista por bloco */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {groups.map(([block, rows]) => (
              <div key={block}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
                    margin: '12px 4px 7px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--color-text-ter)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {blockLabel(block)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--color-text-ter)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {rows.reduce((s, r) => s + r.quantity, 0)} pães · {rows.length}{' '}
                    {rows.length === 1 ? 'entrega' : 'entregas'}
                  </span>
                </div>
                {rows.map((d, i) => {
                  const rLabel = riskLabel(d.risk)
                  const isRisk = !!rLabel
                  return (
                    <div
                      key={`${d.userId}-${d.slotId}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '11px 13px',
                        marginBottom: 8,
                        background: isRisk ? WARN_SOFT : 'var(--color-surface)',
                        border: `1px solid ${isRisk ? 'rgba(180,84,31,0.22)' : 'var(--color-border-2)'}`,
                        borderRadius: 14,
                        boxShadow: 'var(--shadow-soft)',
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: isRisk ? 'rgba(180,84,31,0.12)' : 'var(--color-surface-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-body)',
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: isRisk ? WARN : 'var(--color-accent)',
                          flexShrink: 0,
                        }}
                      >
                        {initials(d.name)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {d.name}
                        </p>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                            margin: '3px 0 0',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            color: 'var(--color-text-ter)',
                            fontWeight: 600,
                          }}
                        >
                          {d.apartment ? <span>Ap {d.apartment}</span> : null}
                          {/* Badge tipo/origem */}
                          {d.source === 'projected' ? (
                            <Badge text="Previsto" fg="var(--color-accent)" border="var(--color-gold-soft)" />
                          ) : d.type === 'SINGLE' ? (
                            <Badge text="Avulso" bg="var(--color-surface-2)" fg="var(--color-text-sec)" />
                          ) : (
                            <Badge text="Agenda" bg="var(--color-good-soft)" fg="var(--color-good)" />
                          )}
                          {rLabel && <Badge text={rLabel} bg={WARN_SOFT} fg={WARN} icon="alert" />}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1,
                            color: 'var(--color-text)',
                            display: 'block',
                          }}
                        >
                          {d.quantity}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 3,
                            fontFamily: 'var(--font-body)',
                            fontSize: 10,
                            fontWeight: 700,
                            color: slotColor(d.slotId),
                          }}
                        >
                          <i style={{ width: 6, height: 6, borderRadius: 2, background: slotColor(d.slotId) }} />
                          {d.slotLabel}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div style={{ height: 8 }} />
          </div>

          {/* Rodapé: exportar / imprimir */}
          <div
            style={{
              display: 'flex',
              gap: 9,
              padding: '11px 16px 18px',
              borderTop: '1px solid var(--color-border-2)',
              background: 'var(--color-app-bg)',
            }}
          >
            <button
              onClick={exportCsv}
              style={{
                flex: 1,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                borderRadius: 13,
                padding: 11,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <Icon name="download" size={16} color="var(--color-text)" stroke={2} />
              Exportar CSV
            </button>
            <button
              onClick={() => window.print()}
              style={{
                flex: 1,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                borderRadius: 13,
                padding: 11,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <Icon name="doc" size={16} color="var(--color-text)" stroke={2} />
              Imprimir
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Coluna de estatística do card de resumo. */
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          color,
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

/** Divisória vertical entre estatísticas. */
function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border-2)', margin: '1px 0' }} />
}

/** Badge pequeno — preenchido (bg) ou contorno (border), com ícone opcional. */
function Badge({
  text,
  bg,
  fg,
  border,
  icon,
}: {
  text: string
  bg?: string
  fg: string
  border?: string
  icon?: 'alert'
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        fontWeight: 700,
        padding: border ? '0px 6px' : '1px 7px',
        borderRadius: 99,
        background: bg ?? 'transparent',
        border: border ? `1px solid ${border}` : undefined,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <Icon name={icon} size={10} color={fg} stroke={2.4} />}
      {text}
    </span>
  )
}
