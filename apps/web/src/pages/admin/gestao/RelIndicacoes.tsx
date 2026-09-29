import { useEffect, useState, type CSSProperties } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import type { ReferralStateKey } from '../../../lib/referral'
import { PeriodPicker, periodQuery, type PeriodSelection } from '../../../components/admin/PeriodPicker'
import { Icon } from '../../../components/brand/Icon'
import { RefCard, RefSkel, RF_BODY, RF_DISPLAY } from '../../../components/client/referral/RefPrimitives'
import { RA_STATE } from '../../../components/admin/referral/RaKit'
import { ReportAppBar, ReportScroll, fmtBRL, fmtInt } from './RelShared'

/** Resposta de `GET /admin/reports/referrals`. */
interface ReferralsReport {
  window: { from: string; to: string; label: string; isPartial: boolean }
  signups: number
  rewarded: number
  conversion: number | null
  breads: { referrer: number; friends: number; total: number }
  unitPrice: number
  cost: { referrer: number; friends: number; total: number }
  revenue: number
  revenuePerReal: number | null
  funnel: { visits: number; signups: number; verified: number; rewarded: number }
  top: Array<{ id: string; name: string; rewarded: number; earnedBreads: number }>
  byState: Record<ReferralStateKey, number>
  caveats: string[]
}

/** Cores da barra "Por estado" — as do handoff. */
const STATE_COLOR: Record<ReferralStateKey, string> = {
  cadastro: 'var(--color-text-ter)',
  aguardando: 'var(--color-gold-soft)',
  analise: 'var(--color-gold)',
  ganhou: 'var(--color-good)',
  recusada: 'var(--color-accent)',
  expirou: 'var(--color-surface-2)',
}
const STATE_ORDER: ReferralStateKey[] = ['cadastro', 'aguardando', 'analise', 'ganhou', 'recusada', 'expirou']

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const breads = (n: number) => String(n).replace('.', ',')

/**
 * A6 — Relatório "Indicações" (handoff `RAReport`), em Relatórios › Aquisição & clientes e pelo
 * atalho do hub do Indique e Ganhe. Período no padrão dos outros relatórios (`PeriodPicker`).
 */
export function RelIndicacoes({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<ReferralsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await apiFetch(`/admin/reports/referrals?${periodQuery(sel)}`)
        if (!res.ok) throw new Error('falha')
        const body = (await res.json()) as ReferralsReport
        if (!cancelled) {
          setData(body)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel])

  const empty = data && data.signups === 0 && data.funnel.visits === 0 && data.breads.total === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Indicações" onBack={onBack} />
      <ReportScroll>
        <div style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 700, marginTop: -8 }}>
          Relatórios › Aquisição & clientes
        </div>
        <PeriodPicker value={sel} onChange={setSel} />

        {loading ? (
          <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <RefSkel key={i} h={78} r={18} />
              ))}
            </div>
            <RefSkel h={190} r={22} />
            <RefSkel h={140} r={22} />
          </div>
        ) : error || !data ? (
          <RefCard pad={20} style={{ textAlign: 'center' }}>
            <div role="alert" style={{ fontFamily: RF_BODY, fontSize: 13.5, color: 'var(--color-text-sec)' }}>
              Não conseguimos carregar o relatório. Tente de novo.
            </div>
          </RefCard>
        ) : empty ? (
          <RefCard pad={26} style={{ textAlign: 'center', marginTop: 10 }}>
            <Icon name="trend" size={28} color="var(--color-text-ter)" />
            <div style={{ fontFamily: RF_DISPLAY, fontWeight: 700, fontSize: 18, color: 'var(--color-text)', marginTop: 10 }}>
              Sem indicações no período
            </div>
            <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', marginTop: 5, lineHeight: 1.5 }}>
              Tente um período maior ou crie uma campanha para movimentar.
            </div>
          </RefCard>
        ) : (
          <Report data={data} />
        )}
      </ReportScroll>
    </div>
  )
}

function Report({ data }: { data: ReferralsReport }) {
  const kpis: Array<[string, string]> = [
    ['Cadastros por indicação', fmtInt(data.signups)],
    ['Recompensadas', fmtInt(data.rewarded)],
    ['Conversão', data.conversion == null ? '—' : `${Math.round(data.conversion * 100)}%`],
    ['Pãezins concedidos', breads(data.breads.total)],
  ]
  const funnel: Array<[string, number]> = [
    ['Visitas pelo link', data.funnel.visits],
    ['Cadastros', data.funnel.signups],
    ['Confirmados', data.funnel.verified],
    ['Recompensados', data.funnel.rewarded],
  ]
  const funnelMax = Math.max(1, ...funnel.map(([, v]) => v))
  const totalByState = STATE_ORDER.reduce((acc, k) => acc + (data.byState[k] ?? 0), 0)
  const costMax = Math.max(data.cost.total, data.revenue, 1)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        {kpis.map(([label, value]) => (
          <RefCard key={label} pad={14}>
            <div style={kpiLabel}>{label}</div>
            <div style={kpiValue}>{value}</div>
          </RefCard>
        ))}
        <RefCard pad={14} style={{ gridColumn: '1 / -1', background: 'var(--color-espresso)', border: 'none' }}>
          <div style={{ ...kpiLabel, color: 'rgba(250,245,236,0.7)' }}>Custo estimado</div>
          <div style={{ ...kpiValue, color: 'var(--color-gold)' }}>{data.unitPrice > 0 ? fmtBRL(data.cost.total) : '—'}</div>
          <div style={{ fontFamily: RF_BODY, fontSize: 12, color: 'rgba(250,245,236,0.7)', marginTop: 2 }}>
            {breads(data.breads.referrer)} para quem indicou · {breads(data.breads.friends)} para amigos
          </div>
        </RefCard>
      </div>

      <RefCard pad={16}>
        <div style={cardTitle}>Funil</div>
        <div style={{ marginTop: 12 }}>
          {funnel.map(([label, value], i) => (
            <div key={label} style={{ marginBottom: i < funnel.length - 1 ? 10 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: RF_BODY, fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)', marginBottom: 5 }}>
                <span>{label}</span>
                <span style={{ color: 'var(--color-text)', fontWeight: 800 }}>
                  {fmtInt(value)}
                  {i > 0 && (
                    <span style={{ color: 'var(--color-text-ter)', fontWeight: 600 }}> · {pctOf(value, funnel[i - 1][1])}%</span>
                  )}
                </span>
              </div>
              <div style={{ height: 12, borderRadius: 99, background: 'var(--color-surface-2)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(4, (value / funnelMax) * 100)}%`,
                    borderRadius: 99,
                    background: i === funnel.length - 1 ? 'var(--color-good)' : 'var(--color-gold)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </RefCard>

      <RefCard pad={16}>
        <div style={cardTitle}>Custo × receita dos indicados</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end', height: 110 }}>
          {(
            [
              ['Custo', data.cost.total, 'var(--color-accent)'],
              ['Receita', data.revenue, 'var(--color-good)'],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: RF_BODY, fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>{fmtBRL(value)}</span>
              <div style={{ width: '100%', height: `${Math.max(8, (value / costMax) * 70)}%`, borderRadius: 10, background: color }} />
              <span style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
        {data.revenuePerReal != null && (
          <div style={{ marginTop: 12, fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)' }}>
            Cada R$ 1 em bônus trouxe <b style={{ color: 'var(--color-good)' }}>{fmtBRL(data.revenuePerReal)}</b> em pedidos.
          </div>
        )}
      </RefCard>

      <RefCard pad={16}>
        <div style={{ ...cardTitle, marginBottom: 6 }}>Top 5 indicadores</div>
        {data.top.length === 0 ? (
          <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-ter)', padding: '6px 0' }}>
            Nenhuma indicação valeu no período.
          </div>
        ) : (
          data.top.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: i < data.top.length - 1 ? '1px solid var(--color-border-2)' : 'none',
              }}
            >
              <span style={{ width: 24, fontFamily: RF_DISPLAY, fontWeight: 800, fontSize: 15, color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-ter)' }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: RF_BODY, fontWeight: 700, fontSize: 13.5, color: 'var(--color-text)' }}>{p.name}</span>
              <span style={{ fontFamily: RF_BODY, fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>{p.rewarded} indic.</span>
              <span style={{ width: 44, textAlign: 'right', fontFamily: RF_DISPLAY, fontWeight: 800, fontSize: 14, color: 'var(--color-good)' }}>
                +{breads(p.earnedBreads)}
              </span>
            </div>
          ))
        )}
      </RefCard>

      {totalByState > 0 && (
        <RefCard pad={16}>
          <div style={{ ...cardTitle, marginBottom: 12 }}>Por estado</div>
          <div aria-hidden="true" style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
            {STATE_ORDER.filter((k) => data.byState[k] > 0).map((k) => (
              <div key={k} style={{ flex: data.byState[k], background: STATE_COLOR[k] }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px 12px', marginTop: 12 }}>
            {STATE_ORDER.map((k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: RF_BODY, fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: STATE_COLOR[k], border: '1px solid var(--color-border)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>{RA_STATE[k].label}</span>
                <b style={{ color: 'var(--color-text)' }}>{data.byState[k]}</b>
                <span style={{ color: 'var(--color-text-ter)' }}>{pctOf(data.byState[k], totalByState)}%</span>
              </div>
            ))}
          </div>
        </RefCard>
      )}

      {data.caveats.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.caveats.map((c) => (
            <p key={c} style={{ fontFamily: RF_BODY, fontSize: 11.5, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.45 }}>
              {c}
            </p>
          ))}
        </div>
      )}
    </>
  )
}

const kpiLabel: CSSProperties = { fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600, lineHeight: 1.3 }
const kpiValue: CSSProperties = {
  fontFamily: RF_DISPLAY,
  fontWeight: 800,
  fontSize: 26,
  letterSpacing: '-0.03em',
  color: 'var(--color-text)',
  marginTop: 6,
}
const cardTitle: CSSProperties = { fontFamily: RF_BODY, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }
