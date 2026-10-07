import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { CRAvatar, CRNote, CRTag } from '../../../components/courier/kit'

interface ReportView {
  id: string
  kind: 'STOP_ISSUE' | 'INCIDENT'
  type: string
  label: string
  text: string | null
  photoUrl: string | null
  /** Houve foto, mas passou dos 90 dias. */
  photoExpired?: boolean
  status: 'OPEN' | 'RESOLVED'
  resolution: string | null
  createdAt: string
  resolvedAt: string | null
  courier: { id: string; name: string }
  stop: { orderId: string | null; marketOrderId: string | null; clientName: string; place: string; status: string | null } | null
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const RESOLUTION: Record<string, string> = { KEPT: 'mantido entregue', CORRECTED: 'marcado não entregue', DONE: 'resolvida' }

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
 * Problemas e ocorrências dos entregadores (E11/E12 no admin): problema numa entrega →
 * "Marcar não entregue" (H-2) ou "Manter entregue"; ocorrência → "Resolvida".
 */
export function CourierReports({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'open' | 'all'>('open')
  const [list, setList] = useState<ReportView[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/admin/courier-reports${tab === 'all' ? '?status=all' : ''}`)
      setList(res.ok ? ((await res.json()) as ReportView[]) : [])
    } catch {
      setList([])
    }
  }, [tab])

  useEffect(() => {
    setList(null)
    void load()
  }, [load])

  const act = async (r: ReportView, kind: 'correct' | 'resolve') => {
    setBusy(r.id)
    setError(null)
    try {
      const id = r.stop?.orderId || r.stop?.marketOrderId
      const res =
        kind === 'correct' && id
          ? await apiFetch(`/admin/orders/${id}/correct-not-delivered`, { method: 'POST', body: JSON.stringify({ note: null }) })
          : await apiFetch(`/admin/courier-reports/${r.id}/resolve`, { method: 'POST' })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Não deu certo. Tente de novo.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu certo. Tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={{ background: 'var(--color-surface-2)', border: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>Entregadores</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Problemas e ocorrências</h2>
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-body)' }}>
        <div role="tablist" aria-label="Reportes" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
          {(
            [
              ['open', 'Abertos'],
              ['all', 'Todos'],
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

        {error && <CRNote tone="danger">{error}</CRNote>}
        {!list && <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-ter)', fontSize: 13 }}>Carregando...</div>}
        {list && list.length === 0 && <CRNote icon="check" tone="good">{tab === 'open' ? 'Nada em aberto. Os problemas e ocorrências dos entregadores aparecem aqui.' : 'Nenhum reporte ainda.'}</CRNote>}

        {list?.map((r) => {
          const open = r.status === 'OPEN'
          return (
            <div key={r.id} role="group" aria-label={`${r.label} — ${r.courier.name}`} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 14, opacity: open ? 1 : 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CRAvatar name={r.courier.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>{r.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)' }}>
                    {r.courier.name} · {when(r.createdAt)}
                  </div>
                </div>
                {open ? (
                  <CRTag icon={r.kind === 'STOP_ISSUE' ? 'alert' : 'moto'} tone={r.kind === 'STOP_ISSUE' ? 'gold' : 'warn'} size="sm">
                    {r.kind === 'STOP_ISSUE' ? 'problema' : 'ocorrência'}
                  </CRTag>
                ) : (
                  <CRTag icon="check" size="sm">
                    {RESOLUTION[r.resolution ?? ''] ?? 'resolvido'}
                  </CRTag>
                )}
              </div>
              {r.stop && (
                <div style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 8 }}>
                  <b>{r.stop.clientName}</b> · {r.stop.place}
                  {r.stop.status === 'NOT_DELIVERED' && <span style={{ color: 'var(--color-warn)', fontWeight: 700 }}> · não entregue</span>}
                </div>
              )}
              {r.text && <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', marginTop: 6, lineHeight: 1.4 }}>“{r.text}”</div>}
              {r.photoUrl && (
                <button type="button" aria-label="Ver a foto da ocorrência" onClick={() => setPhoto(r.photoUrl)} style={{ marginTop: 8, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}>
                  <img src={r.photoUrl} alt="" style={{ width: 96, height: 72, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                </button>
              )}
              {r.photoExpired && (
                <div style={{ marginTop: 8 }}>
                  <CRTag icon="camera" size="sm">
                    foto expirada (90 dias)
                  </CRTag>
                </div>
              )}
              {open && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {r.kind === 'STOP_ISSUE' && r.stop?.status === 'DELIVERED' ? (
                    <>
                      <button type="button" style={btn(true)} disabled={busy === r.id} onClick={() => void act(r, 'correct')}>
                        Marcar não entregue
                      </button>
                      <button type="button" style={btn(false)} disabled={busy === r.id} onClick={() => void act(r, 'resolve')}>
                        Manter entregue
                      </button>
                    </>
                  ) : (
                    <button type="button" style={btn(false)} disabled={busy === r.id} onClick={() => void act(r, 'resolve')}>
                      Marcar como resolvida
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {list && list.some((r) => r.kind === 'STOP_ISSUE' && r.status === 'OPEN') && (
          <CRNote icon="alert">"Marcar não entregue" só corrige o status da parada (pão + Cestinha): sem aviso ao cliente e sem devolver pãezins.</CRNote>
        )}
      </div>

      {photo && (
        <div role="dialog" aria-modal="true" aria-label="Foto da ocorrência" onClick={() => setPhoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 170, background: 'rgba(7,4,2,0.94)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <img src={photo} alt="Foto da ocorrência" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
