import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { CRNote, CRSkel, crMoney } from '../../../components/courier/kit'
import { downloadXlsx } from '../../../lib/xlsx'
import { ReportAppBar } from './RelShared'
import { CourierPayouts } from './CourierPayouts'

interface FuelReport {
  window: { from: string; to: string; label: string; isPartial: boolean }
  runs: number
  km: number
  litros: number
  /** GNV, em m³ (Onda 11 · T-37). Ausente numa API antiga. */
  m3?: number
  gasto: number
  entregas: number
  paes: number
  porEntrega: number | null
  porPao: number | null
  savings: { km: number; value: number | null; runs: number }
  couriers: Array<{ courierId: string; name: string; runs: number; km: number; litros: number; m3?: number; gasto: number; entregas: number; porEntrega: number | null; semConsumo: boolean; semPreco: boolean }>
}

type Preset = '7' | '30' | 'm' | 'c'

function todayBrt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10)
}
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
/** "~12,5 L" ou, com GNV, "~12,5 L · ~3 m³" — litro e m³ não se somam (Onda 11 · T-37). */
const volume = (d: { litros: number; m3?: number }) => [`~${num(d.litros)} L`, (d.m3 ?? 0) > 0 ? `~${num(d.m3!)} m³` : null].filter(Boolean).join(' · ')
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
}

/** Querystring do período (o formato de `lib/period-query.ts` na API). */
function query(p: Preset, range: { from: string; to: string }): string {
  const today = todayBrt()
  if (p === '7') return `from=${addDays(today, -6)}&to=${today}`
  if (p === '30') return `from=${addDays(today, -29)}&to=${today}`
  if (p === 'm') return `month=${today.slice(0, 7)}`
  return `from=${range.from}&to=${range.to}`
}

/**
 * A9 · Combustível & rotas (Relatórios › Operação & financeiro). Tudo estimado pela rota
 * planejada e pelo consumo cadastrado de cada veículo. Mostra o gasto por entregador e quanto as
 * rotas sugeridas que o admin aceitou economizaram.
 */
export function RelCombustivel({ onBack }: { onBack: () => void }) {
  const [preset, setPreset] = useState<Preset>('30')
  const [range, setRange] = useState(() => ({ from: addDays(todayBrt(), -29), to: todayBrt() }))
  const [data, setData] = useState<FuelReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [payouts, setPayouts] = useState(false)

  const q = query(preset, range)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    void (async () => {
      try {
        const res = await apiFetch(`/admin/reports/fuel?${q}`)
        if (!alive) return
        if (res.ok) setData((await res.json()) as FuelReport)
        else setFailed(true)
      } catch {
        if (alive) setFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [q])

  if (payouts) return <CourierPayouts onBack={() => setPayouts(false)} />

  const onExport =
    data && data.runs > 0
      ? () =>
          void downloadXlsx(`combustivel-${data.window.from}-${data.window.to}.xlsx`, [
            {
              name: 'Por entregador',
              notes: [`Combustível & rotas — ${data.window.label}`, 'Tudo estimado pela rota planejada e pelo consumo cadastrado.'],
              head: ['Entregador', 'Rotas', 'Km', 'Litros', 'm³ (GNV)', 'Gasto (R$)', 'Entregas', 'R$/entrega'],
              rows: data.couriers.map((c) => [c.name, c.runs, c.km, c.litros, c.m3 ?? 0, c.gasto, c.entregas, c.porEntrega ?? '']),
              integer: [1, 6],
              footer: [`Total: ~${num(data.km)} km · ${volume(data)} · ≈ ${crMoney(data.gasto)}`, `Rotas aceitas economizaram ~${num(data.savings.km)} km`],
            },
          ])
      : undefined

  const kpis: Array<[string, string, boolean?]> = data
    ? [
        ['Km estimado', `~${num(data.km)}`],
        (data.m3 ?? 0) > 0 ? ['Litros · m³', volume(data)] : ['Litros', `~${num(data.litros)}`],
        ['Gasto', `≈ ${crMoney(data.gasto)}`, true],
        ['Por entrega', data.porEntrega === null ? '—' : crMoney(data.porEntrega)],
        ['Por pão', data.porPao === null ? '—' : crMoney(data.porPao)],
      ]
    : []
  const missing = data?.couriers.filter((c) => c.semConsumo).map((c) => shortName(c.name)) ?? []
  const noPrice = data?.couriers.some((c) => c.semPreco) ?? false

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Combustível & rotas" onBack={onBack} onExport={onExport} />
      <div style={{ overflow: 'auto', flex: 1, padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-body)' }}>
        <div role="radiogroup" aria-label="Período" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
          {(
            [
              ['7', '7 dias'],
              ['30', '30 dias'],
              ['m', 'Mês'],
              ['c', 'Período'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={preset === k}
              onClick={() => setPreset(k)}
              style={{ flex: 1, height: 34, borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-body)', background: preset === k ? 'var(--color-surface)' : 'transparent', color: preset === k ? 'var(--color-text)' : 'var(--color-text-sec)', boxShadow: preset === k ? 'var(--shadow-soft)' : 'none', cursor: 'pointer' }}
            >
              {l}
            </button>
          ))}
        </div>
        {preset === 'c' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {(['from', 'to'] as const).map((k) => (
              <label key={k} style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                {k === 'from' ? 'De' : 'Até'}
                <input
                  type="date"
                  aria-label={k === 'from' ? 'De' : 'Até'}
                  value={range[k]}
                  max={todayBrt()}
                  onChange={(e) => e.target.value && setRange((r) => ({ ...r, [k]: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 6, boxSizing: 'border-box', background: 'var(--color-surface-alt)', border: '1.5px solid var(--color-border)', borderRadius: 12, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)' }}
                />
              </label>
            ))}
          </div>
        )}

        {loading && !data && (
          <>
            <CRSkel h={140} r={20} />
            <CRSkel h={200} r={20} />
          </>
        )}
        {failed && <CRNote tone="danger">Não deu para carregar o relatório. Tente de novo.</CRNote>}

        {data && data.runs === 0 && !loading && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <Icon name="fuel" size={32} color="var(--color-text-ter)" aria-hidden="true" />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--color-text)', marginTop: 10 }}>Sem rotas no período</div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', marginTop: 4 }}>Os números aparecem quando houver rotas encerradas.</div>
          </div>
        )}

        {data && data.runs > 0 && (
          <>
            <CRNote icon="alert">
              Tudo estimado pela rota planejada e pelo consumo cadastrado de cada veículo{data.window.isPartial ? ' · período em andamento' : ''}.
            </CRNote>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {kpis.map(([l, v, dark]) => (
                <div key={l} style={{ background: dark ? 'var(--color-espresso)' : 'var(--color-surface)', borderRadius: 16, padding: 12, border: '1px solid var(--color-border-2)', minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: dark ? 'var(--color-gold)' : 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: dark ? '#C7B595' : 'var(--color-text-sec)' }}>{l}</div>
                </div>
              ))}
              <div style={{ background: 'var(--color-good-soft)', borderRadius: 16, padding: 12, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--color-good)' }}>{data.savings.km > 0 ? `−${num(data.savings.km)} km` : '0 km'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-good)' }}>rotas sugeridas</div>
              </div>
            </div>

            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name="spark" size={20} color="var(--color-accent)" aria-hidden="true" />
              <div style={{ flex: 1, fontSize: 14, color: 'var(--color-text)', fontWeight: 600 }}>
                {data.savings.km > 0 ? (
                  <>
                    Rotas aceitas economizaram <b>~{num(data.savings.km)} km</b> no período{data.savings.value !== null ? ` (≈ ${crMoney(data.savings.value)})` : ''}.
                  </>
                ) : (
                  'Nenhuma rota sugerida aceita economizou km no período.'
                )}
              </div>
            </div>

            {(missing.length > 0 || noPrice) && (
              <CRNote icon="fuel" tone="gold">
                {missing.length > 0 && `Sem consumo cadastrado (fora do gasto): ${missing.join(', ')}. `}
                {noPrice && 'Falta o preço do combustível em Rotas e comprovante.'}
              </CRNote>
            )}

            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, overflow: 'hidden' }} role="table" aria-label="Por entregador">
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '10px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--color-text-ter)', borderBottom: '1px solid var(--color-border-2)' }}>
                <span role="columnheader">ENTREGADOR</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>KM</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>R$</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>R$/ENTR.</span>
              </div>
              {data.couriers.map((c, i) => (
                <div key={c.courierId} role="row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '12px 14px', fontSize: 13.5, borderTop: i ? '1px solid var(--color-border-2)' : 'none', color: 'var(--color-text)' }}>
                  <b role="cell">{shortName(c.name)}</b>
                  <span role="cell" style={{ textAlign: 'right' }}>~{num(c.km)}</span>
                  <span role="cell" style={{ textAlign: 'right' }}>{c.semConsumo ? '—' : c.gasto.toFixed(2).replace('.', ',')}</span>
                  <span role="cell" style={{ textAlign: 'right', fontWeight: 800 }}>{c.porEntrega === null || c.semConsumo ? '—' : c.porEntrega.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPayouts(true)}
              style={{ height: 52, borderRadius: 16, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
            >
              <Icon name="wallet" size={19} aria-hidden="true" />
              Ir para pagamentos
            </button>
          </>
        )}
      </div>
    </div>
  )
}
