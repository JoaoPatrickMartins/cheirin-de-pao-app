import { useCallback, useEffect, useState } from 'react'
import { PAY_MODE_LABELS, consumptionUnit, type PayMode } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon, type Ic } from '../../../components/brand/Icon'
import { CRAvatar, CRBig, CRChoice, CRNote, CRSheet, CRTag, CRTextarea, crMoney } from '../../../components/courier/kit'
import type { PayoutFuelBasis } from '../../../lib/courierApi'

// ------------------------------------------------------------------ tipos (espelham a API)
interface ExpenseBrief {
  id: string
  category: string
  amount: number
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  paidAt: string | null
  dueDate: string | null
}

export interface PayoutView {
  id: string | null
  courierId: string
  name: string
  photoUrl: string | null
  weekStart: string
  weekEnd: string
  status: 'ESTIMATE' | 'PENDING' | 'EDITED' | 'APPROVED' | 'DISCARDED'
  payMode: string | null
  payAmount: number | null
  units: number
  remunerationEst: number
  kmEst: number
  fuelEst: number
  fuelBasis: PayoutFuelBasis | null
  remunerationFinal: number | null
  fuelFinal: number | null
  estimated: number
  final: number
  adjustReason: string | null
  discardReason: string | null
  approvedAt: string | null
  paid: { state: 'PAGO' | 'A_PAGAR'; paidAt: string | null; dueDate: string | null } | null
  paymentMethod: string | null
  expenses: ExpenseBrief[]
  openRuns: number
}

interface WeekList {
  weekStart: string
  weekEnd: string
  state: 'CLOSED' | 'CURRENT' | 'FUTURE' | 'BEFORE_START'
  since: string
  proposals: PayoutView[]
  totals: { count: number; open: number; estimated: number; final: number }
}

// ------------------------------------------------------------------ utilitários
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const period = (a: string, b: string) => `${ddmm(a)}–${ddmm(b)}`
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
}
const num = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10)
}
function todayBrt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
const moneyText = (v: number) => v.toFixed(2).replace('.', ',')
function parseMoney(t: string): number | null {
  const n = Number(t.trim().replace(/\./g, '').replace(',', '.'))
  return t.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100) / 100
}

/** "142 × R$ 1,50" · "10 × R$ 25,00" · "semanal fixo". */
function baseText(p: Pick<PayoutView, 'payMode' | 'units' | 'payAmount'>): string {
  if (p.payMode === 'WEEKLY_FIXED') return 'semanal fixo'
  return `${p.units} × ${crMoney(p.payAmount ?? 0)}`
}

const FUEL_OUT: Record<NonNullable<PayoutFuelBasis['reason']>, string> = {
  NAO_PAGA: 'Combustível não é pago a este entregador.',
  NAO_USA: 'Veículo sem combustível (bicicleta, a pé ou sem veículo).',
  SEM_KM: 'Sem rota encerrada na semana — sem combustível.',
  SEM_CONSUMO: 'Sem consumo cadastrado — sem combustível.',
  SEM_PRECO: 'Sem preço do combustível (Rotas e comprovante) — sem combustível.',
}

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await apiFetch(url, init)
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (res.ok) return { ok: true, data: body as T }
    return { ok: false, error: body?.error ?? 'Não deu certo. Tente de novo.' }
  } catch {
    return { ok: false, error: 'Sem conexão. Tente de novo.' }
  }
}
const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// ------------------------------------------------------------------ peças visuais
const card: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16 }
const smallBtn = (variant: 'gold' | 'ghost' | 'danger'): React.CSSProperties => ({
  flex: 1,
  minHeight: 40,
  borderRadius: 12,
  border: variant === 'gold' ? 'none' : '1.5px solid var(--color-border)',
  background: variant === 'gold' ? 'var(--color-gold)' : 'var(--color-surface)',
  color: variant === 'danger' ? 'var(--color-warn)' : variant === 'gold' ? 'var(--color-espresso)' : 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 13.5,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
})
const fieldLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7, display: 'block' }
const inputBox: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-surface-alt)', border: '1.5px solid var(--color-border)', borderRadius: 14, padding: '12px 14px' }
const bareInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)', minWidth: 0 }

function Field({ label, icon, value, onChange, suffix, type = 'text', inputMode, placeholder }: { label: string; icon: keyof typeof Ic; value: string; onChange: (v: string) => void; suffix?: string; type?: string; inputMode?: 'decimal'; placeholder?: string }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={fieldLabel}>{label}</span>
      <span style={inputBox}>
        <Icon name={icon} size={18} color="var(--color-text-ter)" aria-hidden="true" />
        <input aria-label={label} type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={bareInput} />
        {suffix && <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 700, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </span>
    </label>
  )
}

function StatusTag({ p }: { p: PayoutView }) {
  if (p.status === 'EDITED') return <CRTag icon="edit" tone="gold" size="sm">editada</CRTag>
  if (p.status === 'PENDING') return <CRTag icon="clock" size="sm">pendente</CRTag>
  if (p.status === 'ESTIMATE') return <CRTag icon="clock" size="sm">em andamento</CRTag>
  if (p.status === 'DISCARDED') return <CRTag icon="x" size="sm">descartada</CRTag>
  return p.paid?.state === 'PAGO' ? <CRTag icon="check" tone="good" size="sm">pago</CRTag> : <CRTag icon="clock" tone="gold" size="sm">a pagar</CRTag>
}

/** Linha de status da aprovada / descartada ("Pago 29/09 · Pix" · "Vence 02/10" · "Descartada: …"). */
function resolvedLine(p: PayoutView): string | null {
  if (p.status === 'DISCARDED') return `Descartada${p.discardReason ? `: ${p.discardReason}` : ''}`
  if (p.status !== 'APPROVED' || !p.paid) return null
  if (p.paid.state === 'PAGO') return `Pago${p.paid.paidAt ? ` ${ddmm(p.paid.paidAt)}` : ''}${p.paymentMethod ? ` · ${p.paymentMethod}` : ''}`
  return p.paid.dueDate ? `Vence ${ddmm(p.paid.dueDate)}` : 'A pagar'
}

// ------------------------------------------------------------------ cartão da proposta
function PayCard({ p, onApprove, onEdit, onDiscard, onExpenses }: { p: PayoutView; onApprove: () => void; onEdit: () => void; onDiscard: () => void; onExpenses: () => void }) {
  const nomod = !p.payMode
  const fuel = p.fuelBasis
  const fuelIn = !!fuel && fuel.reason === null
  const ed = p.status === 'EDITED'
  const open = p.status === 'PENDING' || p.status === 'EDITED'
  const line = resolvedLine(p)
  return (
    <div style={{ ...card, padding: 14, opacity: p.status === 'DISCARDED' ? 0.6 : 1 }} aria-label={`Proposta de ${p.name}`} role="group">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CRAvatar name={p.name} photoUrl={p.photoUrl} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{p.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)' }}>{nomod ? 'sem modalidade' : PAY_MODE_LABELS[p.payMode as PayMode]?.label ?? p.payMode}</div>
        </div>
        <StatusTag p={p} />
      </div>
      {nomod && (
        <CRNote icon="alert" tone="gold" style={{ marginTop: 10 }}>
          Modalidade não definida — proposta só com o combustível.
        </CRNote>
      )}
      <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border-2)', fontFamily: 'var(--font-body)' }}>
        {!nomod && (
          <div style={{ display: 'flex', padding: '8px 0', fontSize: 13.5 }}>
            <span style={{ flex: 1, color: 'var(--color-text-sec)' }}>🛵 Remuneração · {baseText(p)}</span>
            <b style={{ whiteSpace: 'nowrap', paddingLeft: 8, color: 'var(--color-text)' }}>{crMoney(p.remunerationEst)}</b>
          </div>
        )}
        {fuelIn ? (
          <div style={{ display: 'flex', padding: '8px 0', fontSize: 13.5, borderTop: nomod ? 'none' : '1px solid var(--color-border-2)' }}>
            <span style={{ flex: 1, color: 'var(--color-text-sec)' }}>
              ⛽ Combustível estimado
              <br />
              <span style={{ fontSize: 12 }}>
                {num(p.kmEst)} km ÷ {num(fuel!.kmPorLitro ?? 0)} {consumptionUnit(fuel!.combustivel)} × {crMoney(fuel!.preco ?? 0)}
              </span>
            </span>
            <b style={{ whiteSpace: 'nowrap', paddingLeft: 8, color: 'var(--color-text)' }}>≈ {crMoney(p.fuelEst)}</b>
          </div>
        ) : (
          fuel?.reason && <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', padding: '4px 0 8px' }}>{FUEL_OUT[fuel.reason]}</div>
        )}
        {p.openRuns > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--color-amber-ink)', padding: '0 0 8px', fontWeight: 700 }}>
            {p.openRuns === 1 ? '1 rota não foi encerrada' : `${p.openRuns} rotas não foram encerradas`} — não entra no cálculo.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', padding: '8px 0 0', borderTop: '1px solid var(--color-border-2)', gap: 6 }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--color-text-ter)' }}>{ed ? 'ESTIMADO → FINAL' : p.status === 'APPROVED' ? 'FINAL' : 'TOTAL ESTIMADO'}</span>
          {p.final !== p.estimated && <span style={{ fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 600, textDecoration: 'line-through' }}>{crMoney(p.estimated)}</span>}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 21, color: 'var(--color-text)' }}>{crMoney(p.final)}</span>
        </div>
        {p.adjustReason && <div style={{ fontSize: 12, color: 'var(--color-text-sec)', textAlign: 'right' }}>Ajuste: {p.adjustReason}</div>}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button type="button" style={{ ...smallBtn('gold'), flex: 1.2 }} onClick={onApprove}>
            <Icon name="check" size={16} stroke={2.4} aria-hidden="true" />
            Aprovar
          </button>
          <button type="button" style={smallBtn('ghost')} onClick={onEdit}>
            <Icon name="edit" size={15} aria-hidden="true" />
            Editar
          </button>
          <button type="button" style={smallBtn('danger')} onClick={onDiscard}>
            Descartar
          </button>
        </div>
      )}
      {line && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>
          <span style={{ flex: 1 }}>{line}</span>
          {p.expenses.length > 0 && <ExpenseLink onClick={onExpenses} />}
        </div>
      )}
    </div>
  )
}

function ExpenseLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ border: 'none', background: 'none', padding: 0, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-accent)', fontWeight: 800, display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
      ver despesa
      <Icon name="external" size={12} aria-hidden="true" />
    </button>
  )
}

// ------------------------------------------------------------------ sheets
function EditSheet({ p, onClose, onSaved }: { p: PayoutView; onClose: () => void; onSaved: (v: PayoutView) => void }) {
  const [rem, setRem] = useState(moneyText(p.remunerationFinal ?? p.remunerationEst))
  const [fuel, setFuel] = useState(moneyText(p.fuelFinal ?? p.fuelEst))
  const [reason, setReason] = useState(p.adjustReason ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const r = parseMoney(rem)
  const f = parseMoney(fuel)
  const total = r !== null && f !== null ? r + f : null
  const save = async () => {
    if (r === null || f === null) return setError('Informe os dois valores (0 vale).')
    setBusy(true)
    setError(null)
    const res = await call<PayoutView>(`/admin/courier-payouts/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remunerationFinal: r, fuelFinal: f, adjustReason: reason.trim() || null }) })
    setBusy(false)
    if (res.ok) onSaved(res.data)
    else setError(res.error)
  }
  return (
    <CRSheet title="Editar proposta" sub={`${shortName(p.name)} · ${period(p.weekStart, p.weekEnd)}`} onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Remuneração final" icon="coin" value={rem} onChange={setRem} inputMode="decimal" suffix={`estimado ${crMoney(p.remunerationEst)}`} />
        <Field label="Combustível final" icon="fuel" value={fuel} onChange={setFuel} inputMode="decimal" suffix={`estimado ${crMoney(p.fuelEst)}`} />
        <Field label="Motivo do ajuste (opcional)" icon="edit" value={reason} onChange={setReason} placeholder="Ex.: desvio por obra na Av. Brasil" />
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface-2)', fontFamily: 'var(--font-body)' }}>
          <span style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>estimado {crMoney(p.estimated)} →</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--color-text)' }}>{total === null ? '—' : crMoney(total)}</span>
        </div>
        {error && <CRNote tone="danger">{error}</CRNote>}
        <CRBig icon="check" onClick={() => void save()} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar edição'}
        </CRBig>
      </div>
    </CRSheet>
  )
}

function ApproveSheet({ p, onClose, onDone }: { p: PayoutView; onClose: () => void; onDone: (v: PayoutView) => void }) {
  const [paid, setPaid] = useState(true)
  const [date, setDate] = useState(todayBrt())
  const [method, setMethod] = useState('Pix')
  const [due, setDue] = useState(addDays(todayBrt(), 5))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rem = p.remunerationFinal ?? p.remunerationEst
  const fuel = p.fuelFinal ?? p.fuelEst
  const approve = async () => {
    setBusy(true)
    setError(null)
    const res = await call<PayoutView>(`/admin/courier-payouts/${p.id}/approve`, post(paid ? { paid: true, paidAt: date, paymentMethod: method.trim() || null } : { paid: false, dueDate: due }))
    setBusy(false)
    if (res.ok) onDone(res.data)
    else setError(res.error)
  }
  return (
    <CRSheet title="Aprovar pagamento" sub={`${shortName(p.name)} · ${crMoney(p.final)}`} onClose={onClose} busy={busy}>
      <div role="radiogroup" aria-label="Pagamento" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CRChoice icon="check" on={paid} onClick={() => setPaid(true)} note="Registra a data e a forma">
          Pago agora
        </CRChoice>
        <CRChoice icon="clock" on={!paid} onClick={() => setPaid(false)} note="Define o vencimento">
          A pagar
        </CRChoice>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        {paid ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Field label="Data" icon="calendar" type="date" value={date} onChange={setDate} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Field label="Forma" icon="wallet" value={method} onChange={setMethod} placeholder="Pix, dinheiro…" />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="Vencimento" icon="calendar" type="date" value={due} onChange={setDue} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 14, borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
        <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--color-text-ter)', background: 'var(--color-surface-alt)' }}>VIRA DESPESA NO FINANCEIRO</div>
        {rem > 0 && (
          <div style={{ display: 'flex', padding: '10px 14px', fontSize: 14, color: 'var(--color-text)' }}>
            <span style={{ flex: 1 }}>🛵 Entregador</span>
            <b>{crMoney(rem)}</b>
          </div>
        )}
        {fuel > 0 && (
          <div style={{ display: 'flex', padding: '10px 14px', fontSize: 14, borderTop: rem > 0 ? '1px solid var(--color-border-2)' : 'none', color: 'var(--color-text)' }}>
            <span style={{ flex: 1 }}>⛽ Combustível</span>
            <b>{crMoney(fuel)}</b>
          </div>
        )}
        <div style={{ padding: '8px 14px 12px', fontSize: 12.5, color: 'var(--color-text-sec)' }}>
          Favorecido: {p.name} · status {paid ? 'pago' : 'a pagar'} · competência {p.weekEnd.slice(5, 7)}/{p.weekEnd.slice(0, 4)}
        </div>
      </div>
      {error && <CRNote tone="danger" style={{ marginTop: 12 }}>{error}</CRNote>}
      <div style={{ height: 14 }} />
      <CRBig variant="gold" icon="check" onClick={() => void approve()} disabled={busy || (paid ? !date : !due)}>
        {busy ? 'Lançando…' : 'Aprovar e lançar'}
      </CRBig>
    </CRSheet>
  )
}

function DiscardSheet({ p, onClose, onDone }: { p: PayoutView; onClose: () => void; onDone: (v: PayoutView) => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const discard = async () => {
    if (reason.trim().length < 3) return setError('Diga o motivo do descarte.')
    setBusy(true)
    setError(null)
    const res = await call<PayoutView>(`/admin/courier-payouts/${p.id}/discard`, post({ reason: reason.trim() }))
    setBusy(false)
    if (res.ok) onDone(res.data)
    else setError(res.error)
  }
  return (
    <CRSheet title="Descartar proposta" sub={`${shortName(p.name)} · ${period(p.weekStart, p.weekEnd)} · não vira despesa`} onClose={onClose} busy={busy}>
      <CRTextarea value={reason} onChange={setReason} label="Motivo do descarte" placeholder="Ex.: rotas cobertas por outro entregador" error={error} maxLength={200} />
      <div style={{ height: 14 }} />
      <CRBig variant="danger" onClick={() => void discard()} disabled={busy}>
        {busy ? 'Descartando…' : 'Descartar'}
      </CRBig>
    </CRSheet>
  )
}

function ExpensesSheet({ p, onClose }: { p: PayoutView; onClose: () => void }) {
  return (
    <CRSheet title="Despesas lançadas" sub={`${p.name} · ${period(p.weekStart, p.weekEnd)}`} onClose={onClose}>
      <div style={{ ...card, overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
        {p.expenses.map((e, i) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>
                {e.category === 'Combustível' ? '⛽' : '🛵'} {e.category}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-sec)' }}>
                {e.status === 'PAID' ? `Paga${e.paidAt ? ` em ${ddmm(e.paidAt)}` : ''}` : e.status === 'PENDING' ? `A pagar${e.dueDate ? ` · vence ${ddmm(e.dueDate)}` : ''}` : 'Cancelada'}
              </span>
            </span>
            <b style={{ color: 'var(--color-text)' }}>{crMoney(e.amount)}</b>
          </div>
        ))}
      </div>
      <CRNote icon="wallet" style={{ marginTop: 12 }}>
        Para marcar como paga ou corrigir, use Financeiro › Contas a pagar ou Despesas.
      </CRNote>
    </CRSheet>
  )
}

// ------------------------------------------------------------------ tela
type SheetState = { kind: 'edit' | 'approve' | 'discard' | 'expenses'; p: PayoutView } | null

/**
 * A8 · Pagamentos dos entregadores: a semana fechada vira proposta (remuneração pela modalidade +
 * combustível estimado). O admin edita, aprova ("pago agora" ou "a pagar" → 2 despesas no
 * Financeiro) ou descarta. A semana em andamento é só estimativa.
 */
export function CourierPayouts({ onBack }: { onBack: () => void }) {
  const [week, setWeek] = useState<string | undefined>(undefined)
  const [data, setData] = useState<WeekList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'p' | 'h'>('p')
  const [history, setHistory] = useState<PayoutView[] | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async (w: string | undefined) => {
    setLoading(true)
    setError(null)
    const res = await call<WeekList>(`/admin/courier-payouts${w ? `?week=${w}` : ''}`)
    setLoading(false)
    if (res.ok) setData(res.data)
    else setError(res.error)
  }, [])

  useEffect(() => {
    void load(week)
  }, [load, week])

  useEffect(() => {
    if (tab !== 'h' || history) return
    void call<PayoutView[]>('/admin/courier-payouts/history').then((r) => setHistory(r.ok ? r.data : []))
  }, [tab, history])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const replace = (v: PayoutView, msg: string) => {
    setSheet(null)
    setData((d) => (d ? { ...d, proposals: d.proposals.map((x) => (x.id === v.id ? v : x)) } : d))
    setHistory(null)
    setToast(msg)
    void load(data?.weekStart)
  }

  const weekLabel = data ? `Semana ${period(data.weekStart, data.weekEnd)}` : 'Semana'
  const sub = !data
    ? ''
    : data.state === 'CURRENT'
      ? `em andamento · total estimado ${crMoney(data.totals.estimated)}`
      : data.state === 'FUTURE'
        ? 'semana que ainda não começou'
        : data.state === 'BEFORE_START'
          ? `antes do início das propostas (${ddmm(data.since)})`
          : `${data.totals.count} ${data.totals.count === 1 ? 'proposta' : 'propostas'} · total estimado ${crMoney(data.totals.estimated)}`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{ background: 'var(--color-surface-2)', border: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>Entregadores</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Pagamentos</h2>
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            aria-label="Semana anterior"
            disabled={!data}
            onClick={() => data && setWeek(addDays(data.weekStart, -7))}
            style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <Icon name="chevL" size={18} color="var(--color-text)" />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--color-text)' }}>{weekLabel}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600 }}>{sub}</div>
          </div>
          <button
            type="button"
            aria-label="Próxima semana"
            disabled={!data || data.state === 'CURRENT' || data.state === 'FUTURE'}
            onClick={() => data && setWeek(addDays(data.weekStart, 7))}
            style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: !data || data.state === 'CURRENT' || data.state === 'FUTURE' ? 0.4 : 1 }}
          >
            <Icon name="chevR" size={18} color="var(--color-text)" />
          </button>
        </div>

        <div role="tablist" aria-label="Pagamentos" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
          {(
            [
              ['p', `Propostas${data && data.state !== 'CURRENT' ? ` · ${data.totals.open}` : ''}`],
              ['h', 'Histórico'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-body)', background: tab === k ? 'var(--color-surface)' : 'transparent', color: tab === k ? 'var(--color-text)' : 'var(--color-text-sec)', boxShadow: tab === k ? 'var(--shadow-soft)' : 'none', cursor: 'pointer' }}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'p' && (
          <>
            {error && <CRNote tone="danger">{error}</CRNote>}
            {loading && !data && <div style={{ textAlign: 'center', padding: 24, fontFamily: 'var(--font-body)', color: 'var(--color-text-ter)', fontSize: 13 }}>Carregando...</div>}
            {data?.state === 'CURRENT' && <CRNote icon="clock">Semana em andamento: só estimativa. As propostas saem na segunda, quando a semana fecha.</CRNote>}
            {data && data.proposals.length === 0 && !loading && (
              <div style={{ ...card, padding: 22, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
                <Icon name="wallet" size={28} color="var(--color-text-ter)" aria-hidden="true" />
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--color-text)', marginTop: 8 }}>Nada a pagar nesta semana</div>
                <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', marginTop: 4 }}>
                  {data.state === 'BEFORE_START' ? 'As propostas começam na semana de ' + ddmm(data.since) + '.' : 'Nenhum entregador com entregas, rotas ou semanal fixo.'}
                </div>
              </div>
            )}
            {data?.proposals.map((p) => (
              <PayCard
                key={p.id ?? p.courierId}
                p={p}
                onApprove={() => setSheet({ kind: 'approve', p })}
                onEdit={() => setSheet({ kind: 'edit', p })}
                onDiscard={() => setSheet({ kind: 'discard', p })}
                onExpenses={() => setSheet({ kind: 'expenses', p })}
              />
            ))}
          </>
        )}

        {tab === 'h' && (
          <>
            {!history && <div style={{ textAlign: 'center', padding: 24, fontFamily: 'var(--font-body)', color: 'var(--color-text-ter)', fontSize: 13 }}>Carregando...</div>}
            {history && history.length === 0 && <CRNote icon="doc">As propostas aprovadas e descartadas aparecem aqui.</CRNote>}
            {history && history.length > 0 && (
              <div style={{ ...card, overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
                {history.map((p, i) => (
                  <div key={p.id} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--color-border-2)' : 'none', opacity: p.status === 'DISCARDED' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>
                        {shortName(p.name)} · <span style={{ fontWeight: 600, color: 'var(--color-text-sec)' }}>{period(p.weekStart, p.weekEnd)}</span>
                      </span>
                      <StatusTag p={p} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-sec)' }}>
                        estimado {crMoney(p.estimated)}
                        {p.status === 'APPROVED' && p.final !== p.estimated ? ' →' : ''}
                      </span>
                      {p.status === 'APPROVED' && p.final !== p.estimated && <b style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--color-text)' }}>{crMoney(p.final)}</b>}
                      <span style={{ flex: 1 }} />
                      {p.expenses.length > 0 && <ExpenseLink onClick={() => setSheet({ kind: 'expenses', p })} />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-ter)', marginTop: 2 }}>{resolvedLine(p)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {sheet?.kind === 'edit' && <EditSheet p={sheet.p} onClose={() => setSheet(null)} onSaved={(v) => replace(v, 'Proposta editada')} />}
      {sheet?.kind === 'approve' && <ApproveSheet p={sheet.p} onClose={() => setSheet(null)} onDone={(v) => replace(v, 'Aprovado · lançado no Financeiro')} />}
      {sheet?.kind === 'discard' && <DiscardSheet p={sheet.p} onClose={() => setSheet(null)} onDone={(v) => replace(v, 'Proposta descartada')} />}
      {sheet?.kind === 'expenses' && <ExpensesSheet p={sheet.p} onClose={() => setSheet(null)} />}
      {toast && (
        <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 160, background: 'var(--color-espresso)', color: '#FAF5EC', borderRadius: 14, padding: '12px 16px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="check" size={18} color="var(--color-gold)" stroke={2.4} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
