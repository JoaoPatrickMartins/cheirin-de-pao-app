import { useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { CRNote, CRTag } from '../courier/kit'

/** Problema reportado pelo entregador numa entrega realizada (E11). */
export interface IssueDetail {
  id: string
  type: string
  label: string
  text: string | null
  createdAt: string
  courierName: string | null
  status: string
  resolution: string | null
}

export interface CorrectionDetail {
  at: string
  byName: string | null
  note: string | null
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const dayTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const shortName = (n: string | null) => {
  if (!n) return 'Entregador'
  const p = n.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
}

const btn = (primary: boolean): React.CSSProperties => ({
  flex: 1,
  minHeight: 40,
  borderRadius: 12,
  border: primary ? 'none' : '1.5px solid var(--color-border)',
  background: primary ? 'var(--color-espresso)' : 'var(--color-surface)',
  color: primary ? '#FAF5EC' : 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 13.5,
  cursor: 'pointer',
})

/**
 * A1 · "problema reportado": o que o entregador disse e as duas saídas — "Marcar não entregue"
 * (H-2: só corrige o status, sem avisar o cliente e sem mexer em pãezins) ou "Manter entregue".
 */
export function OrderIssues({
  issues,
  correction,
  orderId,
  canCorrect,
  onCorrected,
}: {
  issues: IssueDetail[]
  correction: CorrectionDetail | null
  /** Id do pedido (pão ou Cestinha) — a correção vale para a parada inteira. */
  orderId: string
  /** O pedido está como entregue (só aí a correção faz sentido). */
  canCorrect: boolean
  /** Depois de corrigir ou manter: recarrega o detalhe e a lista. */
  onCorrected: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kept, setKept] = useState<Set<string>>(new Set())

  if (issues.length === 0 && !correction) return null

  const correct = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/admin/orders/${orderId}/correct-not-delivered`, { method: 'POST', body: JSON.stringify({ note: note.trim() || null }) })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Não deu para corrigir. Tente de novo.')
      setConfirming(false)
      onCorrected()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu para corrigir. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const keep = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/admin/courier-reports/${id}/resolve`, { method: 'POST' })
      if (!res.ok) throw new Error('Não deu para salvar. Tente de novo.')
      setKept((prev) => new Set(prev).add(id))
      onCorrected()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu para salvar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-body)' }}>
      {issues.map((i) => {
        const open = i.status === 'OPEN' && !kept.has(i.id)
        return (
          <div key={i.id} style={{ background: 'var(--color-note-gold)', borderRadius: 14, padding: '10px 12px' }} role="group" aria-label="Problema reportado">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: 'var(--color-note-gold-ink)' }}>
                {i.label} · {hhmm(i.createdAt)}
              </span>
              {open ? (
                <CRTag icon="alert" tone="gold" size="sm">
                  problema reportado
                </CRTag>
              ) : (
                <CRTag icon="check" size="sm">
                  {i.resolution === 'CORRECTED' ? 'marcado não entregue' : 'mantido entregue'}
                </CRTag>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-note-gold-ink)', marginTop: 2 }}>
              {i.text ? `“${i.text}” — ` : ''}
              {shortName(i.courierName)}
            </div>
            {open && canCorrect && !confirming && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" style={btn(true)} disabled={busy} onClick={() => setConfirming(true)}>
                  Marcar não entregue
                </button>
                <button type="button" style={btn(false)} disabled={busy} onClick={() => void keep(i.id)}>
                  Manter entregue
                </button>
              </div>
            )}
          </div>
        )
      })}

      {confirming && (
        <div style={{ background: 'var(--color-surface-2)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.45 }}>
            A parada inteira (pão + Cestinha) passa para <b>não entregue</b>. O cliente <b>não é avisado</b> e os pãezins <b>não</b> voltam — se precisar, use Estornar.
          </div>
          <input
            aria-label="Nota da correção (opcional)"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            style={{ border: '1.5px solid var(--color-border)', borderRadius: 12, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn(true)} disabled={busy} onClick={() => void correct()}>
              {busy ? 'Corrigindo…' : 'Confirmar: não entregue'}
            </button>
            <button type="button" style={btn(false)} disabled={busy} onClick={() => setConfirming(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {correction && (
        <CRNote icon="edit">
          Corrigido para não entregue em {dayTime(correction.at)}
          {correction.byName ? ` por ${correction.byName}` : ''}
          {correction.note ? ` · “${correction.note}”` : ''}. Sem aviso ao cliente.
        </CRNote>
      )}
      {error && <CRNote tone="danger">{error}</CRNote>}
    </div>
  )
}
