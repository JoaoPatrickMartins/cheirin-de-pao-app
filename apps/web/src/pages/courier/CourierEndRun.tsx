import { useCallback, useEffect, useState } from 'react'
import { consumptionUnit } from '@cheirin-de-pao/shared'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon, type Ic } from '../../components/brand/Icon'
import { TurnoChip } from '../../components/courier/RouteTodayCard'
import { CRBig, CRIconBtn, CRLabel, CRNote, CRSkel, CRSpin, CR_BODY, CR_DISPLAY } from '../../components/courier/kit'
import { brtTime, endRun, fetchRunSummary, fmtDuration, type RunStopRef, type RunSummary } from '../../lib/courierApi'

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const km = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const place = (s: RunStopRef) => [s.condominiumName, s.apartment ? `Apto ${s.apartment}` : s.clientName].filter(Boolean).join(' · ')

/**
 * E10 · Encerrar rota: pendências que bloqueiam (paradas sem desfecho, foto obrigatória pendente,
 * envios guardados no aparelho), o resumo do turno, km/combustível estimados (só com o switch "Fim
 * da rota" do A5 — sem ele, nem o cartão nem o aviso) e a tela de "rota concluída".
 */
export function CourierEndRun({
  slotId,
  pendingSends,
  sending,
  onFlush,
  onResolve,
  onTakePhoto,
  onClose,
  onEnded,
}: {
  slotId: string
  /** Paradas com algo guardado na fila do aparelho. */
  pendingSends: number
  sending: boolean
  onFlush: () => void
  /** "Resolver": volta para a lista. */
  onResolve: () => void
  /** "Tirar foto" de uma parada com foto obrigatória pendente. */
  onTakePhoto: (stop: RunStopRef) => void
  onClose: () => void
  onEnded: () => void
}) {
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [done, setDone] = useState<RunSummary | null>(null)

  const load = useCallback(async () => {
    const r = await fetchRunSummary(slotId)
    if (r.ok) {
      setSummary(r.data)
      setError(null)
    } else setError(r.error)
  }, [slotId])

  useEffect(() => {
    void load()
  }, [load])

  // Quando a fila esvazia (o sinal voltou), as fotos chegaram: atualiza as pendências.
  useEffect(() => {
    if (pendingSends === 0 && !sending) void load()
  }, [pendingSends, sending, load])

  const end = async () => {
    if (!summary?.run) return
    setEnding(true)
    const r = await endRun(summary.run.id)
    setEnding(false)
    if (r.ok) {
      setDone(r.data.summary)
      onEnded()
      return
    }
    const pending = (r.body as { pending?: RunSummary['pending'] } | undefined)?.pending
    if (pending) setSummary({ ...summary, pending })
    setError(r.error)
  }

  if (done) {
    const ended = brtTime(done.run?.endedAt)
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rota concluída"
        style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'var(--color-espresso)', color: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column', padding: 'calc(20px + env(safe-area-inset-top, 0px)) 22px calc(28px + env(safe-area-inset-bottom, 0px))', overflow: 'hidden', fontFamily: CR_BODY }}
      >
        <div style={{ position: 'absolute', top: -60, right: -60, opacity: 0.1 }}>
          <BreadMark size={300} color="#E3AC3F" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div className="cdp-pop" style={{ width: 84, height: 84, borderRadius: 28, background: 'var(--color-gold)', display: 'grid', placeItems: 'center' }}>
            <Icon name="flag" size={40} color="var(--color-espresso)" stroke={2.3} aria-hidden="true" />
          </div>
          <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 22 }}>
            Rota {done.label ? `da ${done.label.toLowerCase()}` : ''} concluída 🥖
          </div>
          <div style={{ fontSize: 16, color: '#C7B595', marginTop: 10, lineHeight: 1.5 }}>
            {done.stats.delivered} {done.stats.delivered === 1 ? 'porta' : 'portas'} com pão fresquinho.{ended ? ` Encerrada às ${ended}.` : ''}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {[
              [String(done.stats.delivered), done.stats.delivered === 1 ? 'entrega' : 'entregas'],
              [String(done.stats.breads), 'pães'],
              done.fuelVisible === true
                ? [done.km !== null ? `~${km(done.km)} km` : '—', 'estimado']
                : [done.stats.durationMin !== null ? fmtDuration(done.stats.durationMin) : '—', 'na rua'],
            ].map(([v, l]) => (
              <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '12px 12px' }}>
                <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 22, color: 'var(--color-gold)' }}>{v}</div>
                <div style={{ fontSize: 12.5, color: '#C7B595', fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {done.next && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, background: 'rgba(227,172,63,0.12)', fontSize: 14.5, fontWeight: 700 }}>
              {done.next.emoji} Próxima: {done.next.label}
              {done.next.time ? ` · ${done.next.time}` : ''} · {done.next.stops} {done.next.stops === 1 ? 'parada' : 'paradas'}
            </div>
          )}
          <CRBig variant="gold" onClick={onClose}>
            Voltar ao início
          </CRBig>
        </div>
      </div>
    )
  }

  const pendStops = summary?.pending.stops ?? []
  const pendPhotos = summary?.pending.noPhoto ?? []
  const blocked = pendStops.length > 0 || pendPhotos.length > 0 || pendingSends > 0
  const started = brtTime(summary?.run?.startedAt)
  const stats: Array<[string, string, keyof typeof Ic | null, string, string?]> = summary
    ? [
        ['Entregues', String(summary.stats.delivered), 'check', 'var(--color-good)'],
        ['Não entregues', String(summary.stats.notDelivered), 'x', 'var(--color-warn)'],
        ['Pães', String(summary.stats.breads), null, 'var(--color-accent)', '🥖'],
        ['Cestinhas', String(summary.stats.cestinhas), 'basket', 'var(--color-accent)'],
        ['Ganchos', String(summary.stats.ganchos), 'hook', 'var(--color-accent)'],
        ['Duração', summary.stats.durationMin !== null ? fmtDuration(summary.stats.durationMin) : '—', 'clock', 'var(--color-accent)'],
      ]
    : []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Encerrar rota"
      style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column', fontFamily: CR_BODY }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px 12px' }}>
        <CRIconBtn icon="arrowL" tone="soft" label="Voltar" onClick={onClose} />
        <h1 style={{ fontFamily: CR_DISPLAY, fontWeight: 700, fontSize: 21, color: 'var(--color-text)', margin: 0 }}>Encerrar rota</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!summary && !error && (
          <>
            <CRSkel h={36} r={14} />
            <CRSkel h={150} r={18} />
            <CRSkel h={90} r={18} />
          </>
        )}
        {summary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TurnoChip route={summary} />
            {started && (
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                {started} → {brtTime(summary.run?.endedAt) ?? 'agora'}
              </span>
            )}
          </div>
        )}

        {summary && blocked && (
          <div style={{ borderRadius: 18, overflow: 'hidden', border: '2px solid var(--color-warn)', background: 'var(--color-surface)' }}>
            <div style={{ padding: '12px 16px', background: 'var(--color-warn-soft)', color: 'var(--color-warn)', fontWeight: 800, fontSize: 14.5, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="alert" size={18} stroke={2.3} aria-hidden="true" />
              Resolva antes de encerrar
            </div>
            {pendStops.length > 0 && (
              <Pending
                icon="list"
                title={pendStops.length === 1 ? '1 parada sem desfecho' : `${pendStops.length} paradas sem desfecho`}
                sub={pendStops.slice(0, 3).map(place).join(', ')}
                action="Resolver"
                onAction={onResolve}
              />
            )}
            {pendPhotos.map((p) => (
              <Pending key={p.key} icon="ban" title="Sem foto" sub={place(p)} action="Tirar foto" onAction={() => onTakePhoto(p)} />
            ))}
            {pendingSends > 0 && (
              <Pending
                icon="cloudOff"
                title={pendingSends === 1 ? '1 envio pendente' : `${pendingSends} envios pendentes`}
                sub="Sobem quando o sinal voltar"
                action={sending ? 'Enviando…' : 'Tentar agora'}
                onAction={onFlush}
              />
            )}
          </div>
        )}

        {summary && (
          <>
            <CRLabel style={{ marginTop: 4 }}>Resumo do turno</CRLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {stats.map(([l, v, ic, c, em]) => (
                <div key={l} style={{ background: 'var(--color-surface)', borderRadius: 16, padding: '12px 12px', border: '1px solid var(--color-border-2)' }}>
                  <div style={{ color: c, height: 18 }}>{em ? <span style={{ fontSize: 15 }}>{em}</span> : ic && <Icon name={ic} size={17} stroke={2.4} aria-hidden="true" />}</div>
                  <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 24, color: 'var(--color-text)', marginTop: 4 }}>{v}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 700 }}>{l}</div>
                </div>
              ))}
            </div>
            {summary.fuelVisible !== true ? null : summary.fuel && summary.km !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--color-surface)', borderRadius: 18, padding: 16, border: '1px solid var(--color-border-2)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--color-gold-soft)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="fuel" size={22} aria-hidden="true" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 20, color: 'var(--color-text)' }}>
                    ~{km(summary.km)} km · ≈ {money(summary.fuel.custo)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.4 }}>
                    Estimado pela rota planejada{summary.voltaBase ? ', com a volta à base' : ''} · {summary.fuel.kmPorLitro} {consumptionUnit(summary.fuel.combustivel)} ·{' '}
                    {summary.fuel.combustivel === 'ETANOL' ? 'etanol' : summary.fuel.combustivel === 'GNV' ? 'GNV' : 'gasolina'} {money(summary.fuel.preco)}
                  </div>
                </div>
              </div>
            ) : (
              <CRNote icon="fuel">
                {summary.km !== null ? `~${km(summary.km)} km estimados. ` : ''}
                {summary.fuelReason === 'SEM_PRECO'
                  ? 'Sem o preço do combustível cadastrado, não calculamos o gasto.'
                  : summary.fuelReason === 'SEM_KM'
                    ? 'Sem o traçado da rota, não estimamos o km nem o combustível.'
                    : 'Sem consumo do veículo cadastrado, não calculamos combustível.'}
              </CRNote>
            )}
          </>
        )}
        {error && (
          <CRNote icon="cloudOff" tone="danger">
            {error}
          </CRNote>
        )}
      </div>
      <div style={{ padding: '10px 16px calc(22px + env(safe-area-inset-bottom, 0px))' }}>
        <CRBig variant="gold" icon={ending ? undefined : 'flag'} h={62} disabled={!summary?.run || blocked || ending} onClick={() => void end()} right={ending ? <CRSpin color="var(--color-espresso)" /> : null}>
          Encerrar rota
        </CRBig>
        {summary && blocked && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 700, marginTop: 8 }}>Libera quando as pendências forem resolvidas</div>
        )}
        {summary && !summary.run && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 700, marginTop: 8 }}>A rota deste turno ainda não começou</div>
        )}
      </div>
    </div>
  )
}

function Pending({ icon, title, sub, action, onAction }: { icon: keyof typeof Ic; title: string; sub: string; action: string; onAction: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--color-border-2)' }}>
      <Icon name={icon} size={20} color="var(--color-warn)" stroke={2.2} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)' }}>{sub}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        style={{ height: 44, padding: '0 12px', borderRadius: 12, border: 'none', background: 'var(--color-espresso)', color: 'var(--color-app-bg)', fontWeight: 800, fontSize: 13, fontFamily: CR_BODY, cursor: 'pointer', flexShrink: 0 }}
      >
        {action}
      </button>
    </div>
  )
}
