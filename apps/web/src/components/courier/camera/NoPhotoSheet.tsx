import { useState } from 'react'
import { NO_PHOTO_REASONS, NO_PHOTO_LABELS, type NoPhotoReason } from '@cheirin-de-pao/shared'
import { CRBig, CRChoice, CRSheet, CRSpin, CRTextarea } from '../kit'
import type { Ic } from '../../brand/Icon'

/**
 * "Não consigo tirar a foto" (E5) — a única saída da foto obrigatória. A parada fica marcada
 * "sem foto" para a operação, com o motivo.
 */
const ICONS: Record<NoPhotoReason, keyof typeof Ic> = { CAMERA_DEFEITO: 'camera', SEM_LUZ: 'flash', OUTRO: 'edit' }

export function NoPhotoSheet({ onConfirm, onClose }: { onConfirm: (reason: NoPhotoReason, text?: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState<NoPhotoReason | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const needsText = reason === 'OUTRO' && text.trim().length < 3

  const confirm = async () => {
    if (!reason || needsText) return
    setBusy(true)
    await onConfirm(reason, reason === 'OUTRO' ? text : undefined)
    setBusy(false)
  }

  return (
    <CRSheet title="Seguir sem foto" sub="A parada fica marcada como “sem foto” para a operação." onClose={onClose} busy={busy}>
      <div role="radiogroup" aria-label="Motivo" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {NO_PHOTO_REASONS.map((r) => (
          <CRChoice key={r} icon={ICONS[r]} on={reason === r} onClick={() => setReason(r)}>
            {NO_PHOTO_LABELS[r]}
          </CRChoice>
        ))}
      </div>
      {reason === 'OUTRO' && <CRTextarea value={text} onChange={setText} placeholder="Conte o que aconteceu" style={{ marginTop: 10 }} />}
      <div style={{ height: 16 }} />
      <CRBig icon={busy ? undefined : 'ban'} disabled={!reason || needsText || busy} onClick={() => void confirm()} right={busy ? <CRSpin color="var(--color-gold)" /> : null}>
        Seguir sem foto
      </CRBig>
    </CRSheet>
  )
}
