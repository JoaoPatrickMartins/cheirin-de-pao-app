import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon, type Ic } from '../../../components/brand/Icon'
import { CRAvatar, CRNote, CRTag } from '../../../components/courier/kit'

/** Acesso para o entregador (A6). Campos vazios = null. */
export interface AccessDraft {
  portaria: string
  temPorteiro: boolean | null
  portao: string
  parar: string
  obs: string
  fotoUrl: string | null
}

export const emptyAccess: AccessDraft = { portaria: '', temPorteiro: null, portao: '', parar: '', obs: '', fotoUrl: null }

export function accessFromApi(a: Partial<Record<keyof AccessDraft, unknown>> | null | undefined): AccessDraft {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    portaria: str(a?.portaria),
    temPorteiro: typeof a?.temPorteiro === 'boolean' ? a.temPorteiro : null,
    portao: str(a?.portao),
    parar: str(a?.parar),
    obs: str(a?.obs),
    fotoUrl: typeof a?.fotoUrl === 'string' ? a.fotoUrl : null,
  }
}

/** O que vai no corpo do PATCH/POST (o servidor normaliza vazios para null). */
export function accessToBody(a: AccessDraft) {
  const t = (v: string) => v.trim() || null
  return { portaria: t(a.portaria), temPorteiro: a.temPorteiro, portao: t(a.portao), parar: t(a.parar), obs: t(a.obs), fotoUrl: a.fotoUrl }
}

interface Suggestion {
  id: string
  field: string
  fieldLabel: string
  text: string
  createdAt: string
  courierName: string
  courierPhotoUrl: string | null
}

const fieldLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7, display: 'block' }
const inputBox: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-surface-alt)', border: '1.5px solid var(--color-border)', borderRadius: 14, padding: '12px 14px' }
const bareInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)', minWidth: 0 }
const smallBtn = (variant: 'gold' | 'ghost'): React.CSSProperties => ({
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 11,
  border: variant === 'gold' ? 'none' : '1.5px solid var(--color-border)',
  background: variant === 'gold' ? 'var(--color-gold)' : 'var(--color-surface)',
  color: variant === 'gold' ? 'var(--color-espresso)' : 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
})

function Field({ label, icon, value, onChange, placeholder }: { label: string; icon: keyof typeof Ic; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={fieldLabel}>{label}</span>
      <span style={inputBox}>
        <Icon name={icon} size={18} color="var(--color-text-ter)" aria-hidden="true" />
        <input aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={bareInput} maxLength={label === 'Observações' ? 500 : 200} />
      </span>
    </label>
  )
}

const dd = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/**
 * A6 · Aba "Acesso" do condomínio: as dicas que o entregador vê no prédio (E7) e as sugestões que
 * os entregadores mandaram (aplicar troca o campo; descartar só arquiva).
 */
export function CondoAccessTab({ condoId, value, onChange }: { condoId?: string; value: AccessDraft; onChange: (a: AccessDraft) => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (!condoId) return
    let alive = true
    void (async () => {
      try {
        const res = await apiFetch(`/admin/condominiums/${condoId}/access-suggestions`)
        if (res.ok && alive) setSuggestions((await res.json()) as Suggestion[])
      } catch {
        // sem as sugestões, a aba segue editável
      }
    })()
    return () => {
      alive = false
    }
  }, [condoId])

  const review = async (s: Suggestion, action: 'apply' | 'discard') => {
    if (!condoId) return
    setBusy(s.id)
    setError(null)
    try {
      const res = await apiFetch(`/admin/condominiums/${condoId}/access-suggestions/${s.id}/${action}`, { method: 'POST' })
      const body = (await res.json().catch(() => null)) as { suggestions?: Suggestion[]; courierAccess?: Record<string, unknown> | null; error?: string } | null
      if (!res.ok) throw new Error(body?.error ?? 'Não deu certo. Tente de novo.')
      setSuggestions(body?.suggestions ?? [])
      if (action === 'apply') onChange(accessFromApi(body?.courierAccess))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu certo. Tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const small = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true })
      const fd = new FormData()
      fd.append('file', small, 'entrada.jpg')
      const res = await apiFetch('/admin/condominiums/access-photo', { method: 'POST', body: fd })
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !body?.url) throw new Error(body?.error ?? 'Não deu para enviar a foto.')
      onChange({ ...valueRef.current, fotoUrl: body.url })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu para enviar a foto.')
    } finally {
      setUploading(false)
    }
  }

  const set = (patch: Partial<AccessDraft>) => onChange({ ...value, ...patch })
  const empty = !value.portaria.trim() && value.temPorteiro === null && !value.portao.trim() && !value.parar.trim() && !value.obs.trim() && !value.fotoUrl

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-body)' }}>
      {suggestions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 4px 8px' }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', textTransform: 'uppercase' }}>Sugestões dos entregadores</span>
            <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: 'var(--color-warn)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 6px' }}>{suggestions.length}</span>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, overflow: 'hidden' }}>
            {suggestions.map((s, i) => (
              <div key={s.id} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CRAvatar name={s.courierName} photoUrl={s.courierPhotoUrl} size={28} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)' }}>
                    {s.courierName} · {dd(s.createdAt)}
                  </span>
                  <CRTag size="sm">{s.fieldLabel}</CRTag>
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-text)', margin: '6px 0 10px 36px' }}>“{s.text}”</div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 36 }}>
                  <button type="button" style={smallBtn('gold')} disabled={busy === s.id} onClick={() => void review(s, 'apply')}>
                    <Icon name="check" size={14} stroke={2.4} aria-hidden="true" />
                    Aplicar
                  </button>
                  <button type="button" style={smallBtn('ghost')} disabled={busy === s.id} onClick={() => void review(s, 'discard')}>
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="Portaria · horário" icon="clock" value={value.portaria} onChange={(v) => set({ portaria: v })} placeholder="Ex.: 05:00–22:00" />
          </div>
          <div style={{ width: 128 }}>
            <span style={fieldLabel}>Tem porteiro?</span>
            <div role="radiogroup" aria-label="Tem porteiro?" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
              {(
                [
                  [true, 'Sim'],
                  [false, 'Não'],
                ] as const
              ).map(([v, l]) => {
                const on = value.temPorteiro === v
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ temPorteiro: on ? null : v })}
                    style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-body)', background: on ? 'var(--color-surface)' : 'transparent', color: on ? 'var(--color-text)' : 'var(--color-text-sec)', boxShadow: on ? 'var(--shadow-soft)' : 'none', cursor: 'pointer' }}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <Field label="Portão / código de acesso" icon="lock" value={value.portao} onChange={(v) => set({ portao: v })} placeholder="Ex.: interfone, tag, código" />
        <Field label="Onde parar o veículo" icon="moto" value={value.parar} onChange={(v) => set({ parar: v })} placeholder="Ex.: vaga de visitante" />
        <Field label="Observações" icon="doc" value={value.obs} onChange={(v) => set({ obs: v })} placeholder="Qualquer dica que ajude às 5 h" />
        <div>
          <span style={fieldLabel}>Foto da entrada</span>
          {value.fotoUrl ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={value.fotoUrl} alt="Entrada do condomínio" style={{ width: 110, height: 80, borderRadius: 14, objectFit: 'cover' }} />
              <button type="button" style={smallBtn('ghost')} disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Icon name="camera" size={14} aria-hidden="true" />
                {uploading ? 'Enviando…' : 'Trocar'}
              </button>
              <button type="button" style={{ ...smallBtn('ghost'), border: 'none', color: 'var(--color-warn)' }} onClick={() => set({ fotoUrl: null })}>
                Remover
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', height: 80, borderRadius: 14, border: '2px dashed var(--color-border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-accent)', fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              <Icon name="camera" size={20} aria-hidden="true" />
              {uploading ? 'Enviando…' : 'Adicionar foto'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Foto da entrada"
            style={{ display: 'none' }}
            onChange={(e) => {
              void upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        {empty && <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)' }}>Sem dicas, o entregador vê “Nenhuma dica ainda · Sugerir”.</div>}
      </div>
      {error && <CRNote tone="danger">{error}</CRNote>}
    </div>
  )
}
