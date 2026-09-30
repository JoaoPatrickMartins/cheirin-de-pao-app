import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import type { ReferralStateKey } from '../../../lib/referral'
import { Icon } from '../../../components/brand/Icon'
import { RefCard, RefSkel, RF_BODY, RF_DISPLAY } from '../../../components/client/referral/RefPrimitives'
import {
  RaBtn,
  RaInline,
  RaSheet,
  RaSheetTitle,
  RaSignal,
  RaSpinner,
  RaStatePill,
  brtDayTime,
  firstNameOf,
} from '../../../components/admin/referral/RaKit'

/** Resposta de `GET /admin/referrals/:id`. */
export interface ReferralDetail {
  id: string
  state: ReferralStateKey
  referrer: { id: string; name: string }
  referred: { id: string; name: string }
  condo: string | null
  signals: string[]
  code: string
  source: string
  rewardBreads: number
  welcomeBreads: number
  campaignLabel: string | null
  timeline: { cadastro: string; login: string | null; pagamento: string | null; entrega: string | null; recompensa: string | null }
  reviewedAt: string | null
  rejectReason: string | null
  rejectDetail: string | null
  expiresAt: string | null
}

/** Motivos da recusa (D-12) — os chips do handoff, na ordem dele. */
export const REJECT_REASONS = [
  { key: 'SAME_RESIDENCE', label: 'Mesma residência' },
  { key: 'SAME_DEVICE', label: 'Mesmo aparelho' },
  { key: 'DUPLICATE_ACCOUNT', label: 'Conta duplicada' },
  { key: 'OTHER', label: 'Outro' },
] as const

type RejectReason = (typeof REJECT_REASONS)[number]['key']

/** O primeiro sinal já sugere o motivo — um toque a menos para o caso comum. */
function suggestedReason(signals: string[]): RejectReason | null {
  if (signals[0] === 'Mesmo apartamento') return 'SAME_RESIDENCE'
  if (signals[0] === 'Mesmo aparelho') return 'SAME_DEVICE'
  return null
}

type Mode = 'view' | 'approve' | 'reject' | 'done' | 'rejected'

/** Pãezins do quadro de valores: "+5"; bônus zero vira "—" (não houve). */
function plus(n: number): string {
  return n > 0 ? `+${String(n).replace('.', ',')}` : '—'
}

/** Abre o detalhe de um cliente na aba Clientes (o `AdminLayout` escuta este evento). */
function openClient(clientId: string) {
  window.dispatchEvent(new CustomEvent('cdp:open-admin-client', { detail: { clientId } }))
}

/**
 * A4 — Detalhe de uma indicação (handoff `RADetail`): as duas pessoas como atalho, sinais, valores
 * congelados e a linha do tempo. Só "Em análise" tem ações (D-12): aprovar com confirmação, ou
 * recusar com motivo + detalhe obrigatório.
 */
export function IndicacaoDetalheSheet({
  id,
  onClose,
  onDecided,
}: {
  id: string
  onClose: () => void
  /** Aprovou ou recusou — a lista e as contagens precisam ser recarregadas. */
  onDecided: () => void
}) {
  const [detail, setDetail] = useState<ReferralDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [mode, setMode] = useState<Mode>('view')
  const [reason, setReason] = useState<RejectReason | null>(null)
  const [rejectDetail, setRejectDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/admin/referrals/${id}`)
        if (!res.ok) throw new Error('falha')
        const data = (await res.json()) as ReferralDetail
        if (cancelled) return
        setDetail(data)
        setLoadError(false)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const decide = async (path: 'approve' | 'reject') => {
    if (!detail) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await apiFetch(`/admin/referrals/${detail.id}/${path}`, {
        method: 'POST',
        body: path === 'reject' ? JSON.stringify({ reason, detail: rejectDetail.trim() }) : undefined,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setActionError(body?.error ?? 'Não foi possível concluir. Tente novamente.')
        // Outro admin decidiu antes (409): o estado mostrado ficou velho.
        if (res.status === 409) {
          setMode('view')
          setReloadKey((k) => k + 1)
          onDecided()
        }
        return
      }
      setMode(path === 'approve' ? 'done' : 'rejected')
      onDecided()
    } catch {
      setActionError('Erro de conexão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const titleId = 'ref-detail-title'

  if (!detail) {
    return (
      <RaSheet labelledBy={titleId} onClose={onClose}>
        <RaSheetTitle id={titleId}>Indicação</RaSheetTitle>
        {loadError ? (
          <>
            <RaInline>Não conseguimos carregar esta indicação.</RaInline>
            <RaBtn variant="soft" icon="refresh" onClick={() => setReloadKey((k) => k + 1)}>
              Tentar de novo
            </RaBtn>
          </>
        ) : (
          <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RefSkel h={64} r={16} />
            <RefSkel h={70} r={22} />
            <RefSkel h={190} r={22} />
          </div>
        )}
      </RaSheet>
    )
  }

  const r = detail
  const de = firstNameOf(r.referrer.name)
  const para = firstNameOf(r.referred.name)
  const pillState: ReferralStateKey = mode === 'done' ? 'ganhou' : mode === 'rejected' ? 'recusada' : r.state
  const reviewing = r.state === 'analise' && mode !== 'done' && mode !== 'rejected'

  // Último passo da linha do tempo: depende do desfecho.
  const lastStep = (() => {
    if (mode === 'done') return { label: 'Recompensa creditada', at: 'agora', kind: 'ok' as const }
    if (mode === 'rejected') return { label: 'Recusada', at: 'agora', kind: 'no' as const }
    switch (r.state) {
      case 'analise':
        return { label: 'Em análise', at: 'aguardando você', kind: 'warn' as const }
      case 'ganhou':
        return { label: 'Recompensa', at: r.timeline.recompensa ? brtDayTime(r.timeline.recompensa) : '—', kind: 'ok' as const }
      case 'recusada':
        return { label: 'Recusada', at: r.reviewedAt ? brtDayTime(r.reviewedAt) : '—', kind: 'no' as const }
      case 'expirou':
        return { label: 'Prazo encerrado', at: r.expiresAt ? brtDayTime(r.expiresAt) : '—', kind: 'no' as const }
      default:
        return { label: 'Recompensa', at: '—', kind: 'none' as const }
    }
  })()

  const steps: Array<{ key: string; label: string; at: string | null; kind: 'ok' | 'warn' | 'no' | 'none' }> = [
    { key: 'cadastro', label: 'Cadastro', at: brtDayTime(r.timeline.cadastro), kind: 'ok' },
    ...(
      [
        ['login', '1º login'],
        ['pagamento', '1º pagamento'],
        ['entrega', '1ª entrega'],
      ] as const
    ).map(([k, label]) => {
      const iso = r.timeline[k]
      return { key: k, label, at: iso ? brtDayTime(iso) : null, kind: iso ? ('ok' as const) : ('none' as const) }
    }),
    { key: 'fim', ...lastStep },
  ]

  const person = (tag: string, p: { id: string; name: string }) => (
    <button
      type="button"
      onClick={() => {
        onClose()
        openClient(p.id)
      }}
      aria-label={`${tag === 'QUEM INDICOU' ? 'Quem indicou' : 'Quem veio pela indicação'}: ${p.name} — abrir cliente`}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 64,
        padding: '10px 12px',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-alt)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: RF_BODY,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)' }}>{tag}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span
          style={{
            flex: 1,
            fontWeight: 800,
            fontSize: 14,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {p.name}
        </span>
        <Icon name="chevR" size={15} color="var(--color-text-ter)" />
      </div>
    </button>
  )

  const reasonLabel = REJECT_REASONS.find((x) => x.key === r.rejectReason)?.label ?? r.rejectReason

  return (
    <RaSheet labelledBy={titleId} onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RaSheetTitle id={titleId}>Indicação</RaSheetTitle>
        <RaStatePill state={pillState} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {/* "Quem veio", e não o "Indicado" do handoff: o sistema não sabe o gênero (V-41) */}
        {person('QUEM INDICOU', r.referrer)}
        {person('QUEM VEIO', r.referred)}
      </div>

      {r.signals.length > 0 && mode !== 'done' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.signals.map((s) => (
            <RaSignal key={s}>{s}</RaSignal>
          ))}
        </div>
      )}

      <RefCard pad={0} style={{ display: 'flex' }}>
        {(
          [
            ['Quem indicou', plus(r.rewardBreads)],
            ['Amigo', plus(r.welcomeBreads)],
            ['Campanha', r.campaignLabel || '—'],
          ] as const
        ).map(([a, b], i) => (
          <div key={a} style={{ flex: 1, minWidth: 0, padding: '12px 10px', textAlign: 'center', borderLeft: i ? '1px solid var(--color-border-2)' : 'none' }}>
            <div style={{ fontFamily: RF_BODY, fontSize: 11, color: 'var(--color-text-ter)', fontWeight: 700 }}>{a}</div>
            <div
              style={{
                fontFamily: RF_DISPLAY,
                fontWeight: 800,
                fontSize: i < 2 ? 20 : 13,
                color: 'var(--color-text)',
                marginTop: 4,
                lineHeight: 1.2,
              }}
            >
              {b}
            </div>
          </div>
        ))}
      </RefCard>
      <div style={{ fontFamily: RF_BODY, fontSize: 11.5, color: 'var(--color-text-ter)', marginTop: -6, textAlign: 'center' }}>
        Valores congelados no momento do cadastro
      </div>

      <RefCard pad={16}>
        <ol aria-label="Linha do tempo" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {steps.map((s, i) => {
            const next = steps[i + 1]
            const done = s.kind === 'ok' || s.kind === 'warn' || s.kind === 'no'
            const dotBg =
              s.kind === 'warn' ? 'var(--color-gold)' : s.kind === 'ok' ? 'var(--color-good)' : 'var(--color-surface-2)'
            return (
              <li key={s.key} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: next ? 14 : 0 }}>
                {next && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: 22,
                      bottom: 0,
                      width: 2,
                      background: next.kind === 'ok' ? 'var(--color-good)' : 'var(--color-border)',
                    }}
                  />
                )}
                <div
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    background: dotBg,
                    color: s.kind === 'warn' ? 'var(--color-espresso)' : s.kind === 'no' ? 'var(--color-text-sec)' : '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {done && <Icon name={s.kind === 'warn' ? 'search' : s.kind === 'no' ? 'x' : 'check'} size={12} stroke={3} />}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: RF_BODY }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: done ? 'var(--color-text)' : 'var(--color-text-ter)' }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600, textAlign: 'right' }}>{s.at ?? '—'}</span>
                </div>
              </li>
            )
          })}
        </ol>
      </RefCard>

      {r.state === 'recusada' && mode === 'view' && (r.rejectReason || r.rejectDetail) && (
        <div style={{ background: 'var(--color-surface-2)', borderRadius: 14, padding: '12px 14px', fontFamily: RF_BODY }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)' }}>MOTIVO DA RECUSA</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>{reasonLabel}</div>
          {r.rejectDetail && (
            <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.45, wordBreak: 'break-word' }}>
              {r.rejectDetail}
            </div>
          )}
        </div>
      )}

      {actionError && <RaInline>{actionError}</RaInline>}

      {reviewing && mode === 'view' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <RaBtn
            full
            variant="ghost"
            icon="x"
            onClick={() => {
              setActionError(null)
              setReason((cur) => cur ?? suggestedReason(r.signals))
              setMode('reject')
            }}
          >
            Recusar
          </RaBtn>
          <RaBtn
            full
            icon="check"
            onClick={() => {
              setActionError(null)
              setMode('approve')
            }}
          >
            Aprovar
          </RaBtn>
        </div>
      )}

      {reviewing && mode === 'approve' && (
        <RefCard pad={16} style={{ border: '1.5px solid var(--color-good)' }}>
          <div style={{ fontFamily: RF_BODY, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>Aprovar esta indicação?</div>
          <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', marginTop: 4, lineHeight: 1.45 }}>
            {r.welcomeBreads > 0
              ? `${de} ganha ${plus(r.rewardBreads)} e ${para} ganha ${plus(r.welcomeBreads)} agora. As duas pessoas recebem uma notificação.`
              : `${de} ganha ${plus(r.rewardBreads)} agora e recebe uma notificação.`}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <RaBtn full variant="soft" disabled={busy} onClick={() => setMode('view')}>
              Voltar
            </RaBtn>
            <RaBtn full icon={busy ? undefined : 'check'} disabled={busy} onClick={() => void decide('approve')}>
              {busy ? <RaSpinner /> : null}
              Aprovar
            </RaBtn>
          </div>
        </RefCard>
      )}

      {reviewing && mode === 'reject' && (
        <RefCard pad={16} style={{ border: '1.5px solid var(--color-warn)' }}>
          <div id="ref-reject-title" style={{ fontFamily: RF_BODY, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>
            Recusar indicação
          </div>
          <div style={{ fontFamily: RF_BODY, fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 4, lineHeight: 1.45 }}>
            O motivo fica só aqui. O cliente vê apenas "Não valeu".
          </div>
          <div role="radiogroup" aria-labelledby="ref-reject-title" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {REJECT_REASONS.map((m) => {
              const on = reason === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(m.key)}
                  style={{
                    minHeight: 34,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderRadius: 999,
                    border: `1.5px solid ${on ? 'var(--color-warn)' : 'var(--color-border)'}`,
                    background: on ? 'var(--color-warn-soft)' : 'var(--color-surface)',
                    color: on ? 'var(--color-warn)' : 'var(--color-text)',
                    fontFamily: RF_BODY,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          <textarea
            rows={2}
            aria-label="Detalhe da recusa (obrigatório)"
            placeholder="Detalhe (obrigatório)"
            value={rejectDetail}
            maxLength={500}
            onChange={(e) => setRejectDetail(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 10,
              resize: 'none',
              borderRadius: 12,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-surface-alt)',
              padding: '10px 12px',
              fontSize: 13.5,
              fontFamily: RF_BODY,
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <RaBtn full variant="soft" disabled={busy} onClick={() => setMode('view')}>
              Voltar
            </RaBtn>
            <RaBtn
              full
              variant="danger"
              disabled={busy || !reason || rejectDetail.trim().length < 3}
              onClick={() => void decide('reject')}
            >
              {busy ? <RaSpinner color="#FFFFFF" /> : null}
              Recusar
            </RaBtn>
          </div>
        </RefCard>
      )}

      {mode === 'done' && (
        <RaInline tone="good">
          {r.welcomeBreads > 0
            ? `Aprovada. ${plus(r.rewardBreads)} pãezins para ${de} e ${plus(r.welcomeBreads)} para ${para}.`
            : `Aprovada. ${plus(r.rewardBreads)} pãezins para ${de}.`}
        </RaInline>
      )}
      {mode === 'rejected' && <RaInline tone="good">Recusada. O cliente vê apenas "Não valeu".</RaInline>}
      {(mode === 'done' || mode === 'rejected') && (
        <RaBtn full variant="soft" onClick={onClose}>
          Fechar
        </RaBtn>
      )}
    </RaSheet>
  )
}
