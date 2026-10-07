import { useState } from 'react'
import { blockLabel } from '@cheirin-de-pao/shared'
import { CRBig, CRCesta, CRSheet, CRSpin, CRTag, CR_DISPLAY } from './kit'
import type { Stop } from './StopRow'

/**
 * E6 · Confirmar pela lista — sheet de baixo com o resumo GRANDE da parada (o mesmo olhar do
 * pop-up do scan). Substitui o modal central antigo (`ConfirmDeliveryDialog`).
 */
export function ConfirmSheet({
  stop,
  condominiumName,
  onConfirm,
  onFail,
  onClose,
}: {
  stop: Stop
  condominiumName: string
  /** Confirma; a tela abre o pop-up E4 e depois a foto. */
  onConfirm: () => Promise<void>
  onFail: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const loc = [stop.block ? blockLabel(stop.block) : null, stop.complement].filter(Boolean).join(' · ')
  // Parada só de gancho: o gancho é a entrega (sem pão nem Cestinha).
  const hookOnly = !!stop.hookId

  const confirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <CRSheet onClose={onClose} busy={busy}>
      <div style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 700 }}>{condominiumName}</div>
      <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 50, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 4 }}>
        {stop.apartment ? `Apto ${stop.apartment}` : stop.clientName}
      </div>
      {loc && <div style={{ fontFamily: CR_DISPLAY, fontWeight: 700, fontSize: 21, color: 'var(--color-accent)', marginTop: 4 }}>{loc}</div>}
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{stop.clientName}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
        {stop.quantity > 0 && (
          <span style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 18, marginRight: 4 }}>
            {stop.quantity === 1 ? '1 pão' : `${stop.quantity} pães`} <span aria-hidden="true">🥖</span>
          </span>
        )}
        <CRCesta items={stop.marketItems} />
        {hookOnly ? (
          <CRTag emoji="🪝" tone="dark">Gancho de porta</CRTag>
        ) : (
          stop.hookToDeliver && <CRTag emoji="🪝" tone="dark">+ entregar gancho</CRTag>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        <CRBig icon={busy ? undefined : 'check'} h={62} disabled={busy} onClick={() => void confirm()} right={busy ? <CRSpin color="var(--color-gold)" /> : null}>
          {busy ? 'Confirmando…' : hookOnly ? 'Gancho entregue' : 'Confirmar entrega'}
        </CRBig>
        <CRBig variant="danger" icon="x" disabled={busy} onClick={onFail}>Não consegui entregar</CRBig>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{ minHeight: 48, background: 'none', border: 'none', fontSize: 15, fontWeight: 700, color: 'var(--color-text-sec)', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
    </CRSheet>
  )
}
