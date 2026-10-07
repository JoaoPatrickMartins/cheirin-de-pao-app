import { useState } from 'react'
import { SHIFT_DECLINE_REASONS, type ShiftDeclineReason } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { CRBig, CRNote, CRSheet, CR_BODY, CR_DISPLAY } from './kit'
import { supportWhatsappUrl } from '../../lib/support'
import type { ShiftOffer } from '../../lib/courierApi'

const stopsText = (n: number) => (n === 1 ? '1 parada' : `${n} paradas`)

/**
 * Turno oferecido (plano-termos-legais §5 · D-T1/D-T5): Aceitar / Recusar. Sem resposta, o turno fica
 * com o entregador; a recusa é livre até iniciar a rota ou resolver a 1ª parada e não tem penalidade.
 */
export function ShiftOfferCard({ shift, onAccept, onDecline, busy }: { shift: ShiftOffer; onAccept: () => void; onDecline: () => void; busy?: boolean }) {
  const title = `${shift.emoji ? `${shift.emoji} ` : ''}Turno da ${shift.label.toLowerCase()}`
  if (shift.status === 'ACCEPTED') {
    return (
      <div role="group" aria-label={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 16, background: 'var(--color-good-soft)', fontFamily: CR_BODY }}>
        <Icon name="check" size={18} color="var(--color-good)" stroke={2.6} aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
          {title} aceito · {stopsText(shift.stops)}
        </span>
        <button type="button" onClick={onDecline} style={{ border: 'none', background: 'none', color: 'var(--color-warn)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', padding: '4px 2px' }}>
          Recusar
        </button>
      </div>
    )
  }
  return (
    <div role="group" aria-label={title} style={{ padding: 16, borderRadius: 20, background: 'var(--color-surface)', border: '1.5px solid var(--color-gold)', fontFamily: CR_BODY }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--color-accent)' }}>TURNO OFERECIDO</div>
      <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 19, color: 'var(--color-text)', marginTop: 4, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 600, marginTop: 2 }}>
        {stopsText(shift.stops)}
        {shift.time ? ` · entrega ${shift.time}` : ''}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', marginTop: 8, lineHeight: 1.4 }}>Aceite ou recuse, sem penalidade. Sem resposta, o turno fica com você.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <CRBig h={48} icon="check" onClick={onAccept} disabled={busy} style={{ flex: 1 }}>
          Aceitar
        </CRBig>
        <CRBig h={48} variant="ghost" onClick={onDecline} disabled={busy} style={{ flex: 1 }}>
          Recusar
        </CRBig>
      </div>
    </div>
  )
}

/**
 * Recusar o turno: motivo OPCIONAL e o aviso de que não há penalidade. Precisa de sinal (T-T3) —
 * sem sinal, aponta o WhatsApp da operação.
 */
export function DeclineShiftSheet({
  shift,
  onConfirm,
  onClose,
}: {
  shift: ShiftOffer
  /** Devolve null (deu certo), 'offline' ou a mensagem de erro. */
  onConfirm: (reason: ShiftDeclineReason | null) => Promise<string | null>
  onClose: () => void
}) {
  const [reason, setReason] = useState<ShiftDeclineReason | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const err = await onConfirm(reason)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <CRSheet title={`Recusar o turno da ${shift.label.toLowerCase()}?`} sub={`${stopsText(shift.stops)}${shift.time ? ` · entrega ${shift.time}` : ''}`} onClose={onClose} busy={busy}>
      <div style={{ fontFamily: CR_BODY, fontSize: 13, fontWeight: 700, color: 'var(--color-text-sec)', margin: '4px 0 8px' }}>Motivo (opcional)</div>
      <div role="radiogroup" aria-label="Motivo da recusa" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SHIFT_DECLINE_REASONS.map((r) => {
          const on = reason === r.key
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setReason(on ? null : r.key)}
              style={{ minHeight: 40, padding: '0 14px', borderRadius: 99, border: on ? '2px solid var(--color-espresso)' : '1.5px solid var(--color-border)', background: on ? 'var(--color-surface-2)' : 'var(--color-surface)', color: 'var(--color-text)', fontFamily: CR_BODY, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <CRNote icon="shield" tone="good" style={{ marginTop: 14 }}>
        Recusar não tem penalidade. As entregas voltam para a operação redistribuir.
      </CRNote>
      {error === 'offline' ? (
        <CRNote icon="cloudOff" tone="danger" style={{ marginTop: 10 }}>
          Sem sinal agora. Para recusar já,{' '}
          <a href={supportWhatsappUrl(`Olá! Preciso recusar o turno da ${shift.label.toLowerCase()} de hoje.`)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 800 }}>
            fale com a operação
          </a>
          .
        </CRNote>
      ) : (
        error && (
          <CRNote icon="alert" tone="danger" style={{ marginTop: 10 }}>
            {error}
          </CRNote>
        )
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        <CRBig variant="dangerFill" icon="x" onClick={() => void confirm()} disabled={busy}>
          {busy ? 'Recusando…' : 'Recusar turno'}
        </CRBig>
        <CRBig variant="ghost" onClick={onClose} disabled={busy}>
          Manter o turno
        </CRBig>
      </div>
    </CRSheet>
  )
}
