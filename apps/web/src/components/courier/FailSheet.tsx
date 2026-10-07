import { useState } from 'react'
import { FAILURE_CODES, FAILURE_LABELS, type FailureCode } from '@cheirin-de-pao/shared'
import { Icon, type Ic } from '../brand/Icon'
import { CRBig, CRLabel, CRNote, CRSheet, CRSpin, CRTag, CRTextarea, CR_BODY } from './kit'
import type { Stop } from './StopRow'

/**
 * E6 · Não consegui entregar — motivos padronizados (M-4), "Outro" exige texto, e a foto da porta
 * ou da portaria vem em seguida (obrigatória ou opcional, conforme a regra do entregador).
 * Sem sinal (Onda 4), a não entrega fica guardada no aparelho e o botão vira "Guardado · seguir
 * para a foto".
 */
const ICONS: Record<FailureCode, keyof typeof Ic> = {
  CLIENTE_AUSENTE: 'user',
  PORTARIA_NAO_LIBEROU: 'gate',
  ENDERECO_NAO_ENCONTRADO: 'search',
  SEM_LUGAR: 'box',
  PEDIDO_DANIFICADO: 'alert',
  OUTRO: 'edit',
}

export function FailSheet({
  stop,
  photoRequired,
  onSubmit,
  onClose,
  error,
  saved = false,
  onContinue,
  onRecado,
}: {
  stop: Stop
  photoRequired: boolean
  onSubmit: (code: FailureCode, reason?: string) => Promise<void>
  onClose: () => void
  /** Recusa do servidor que não dá para guardar (ex.: dados inválidos). */
  error?: string | null
  /** Sem sinal: a não entrega ficou guardada na fila; o motivo não muda mais. */
  saved?: boolean
  /** Guardada: segue para a foto. */
  onContinue?: () => void
  /** E16: "Avisar o cliente" (só com a permissão de recados). */
  onRecado?: () => void
}) {
  const [code, setCode] = useState<FailureCode | null>(null)
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const otherEmpty = code === 'OUTRO' && text.trim().length < 3
  const disabled = saved ? false : !code || otherEmpty || busy

  const submit = async () => {
    setTouched(true)
    if (!code || otherEmpty) return
    setBusy(true)
    await onSubmit(code, text)
    setBusy(false)
  }

  return (
    <CRSheet title="Não consegui entregar" sub={`${stop.apartment ? `Apto ${stop.apartment}` : ''}${stop.block ? ` · Bloco ${stop.block}` : ''} · ${stop.clientName}`} onClose={onClose} busy={busy}>
      <CRLabel>Motivo</CRLabel>
      <div role="radiogroup" aria-label="Motivo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {FAILURE_CODES.map((c) => {
          const on = code === c
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => !saved && setCode(c)}
              aria-disabled={saved || undefined}
              style={{
                minHeight: 58,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 16,
                border: `2px solid ${on ? 'var(--color-warn)' : 'var(--color-border)'}`,
                background: on ? 'var(--color-warn-soft)' : 'var(--color-surface)',
                color: on ? 'var(--color-warn)' : 'var(--color-text)',
                fontFamily: CR_BODY,
                fontSize: 13.5,
                fontWeight: 800,
                textAlign: 'left',
                lineHeight: 1.2,
                cursor: 'pointer',
              }}
            >
              <Icon name={on ? 'check' : ICONS[c]} size={17} stroke={2.3} aria-hidden="true" />
              {FAILURE_LABELS[c]}
            </button>
          )
        })}
      </div>
      {code === 'OUTRO' && (
        <CRTextarea
          value={text}
          onChange={setText}
          label="Motivo"
          error={touched && otherEmpty ? 'Escreva o motivo para seguir' : null}
          style={{ marginTop: 10 }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface-2)' }}>
        <Icon name="camera" size={19} color="var(--color-accent)" aria-hidden="true" />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Em seguida: foto da porta ou portaria</span>
        <CRTag tone={photoRequired ? 'dark' : 'neutral'} size="sm">{photoRequired ? 'obrigatória' : 'opcional'}</CRTag>
      </div>
      {onRecado && (
        <button
          type="button"
          onClick={onRecado}
          style={{ marginTop: 8, width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 14, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', cursor: 'pointer' }}
        >
          <Icon name="chat" size={19} color="var(--color-accent)" aria-hidden="true" />
          <span style={{ flex: 1, textAlign: 'left' }}>Avisar o cliente</span>
          <Icon name="chevR" size={17} color="var(--color-text-ter)" aria-hidden="true" />
        </button>
      )}
      {error && <CRNote icon="cloudOff" tone="danger" style={{ marginTop: 12 }}>{error}</CRNote>}
      {saved && (
        <CRNote icon="cloudOff" tone="gold" style={{ marginTop: 12 }}>
          Sem sinal agora. Guardamos a não entrega e enviamos sozinhos.
        </CRNote>
      )}
      <div style={{ height: 16 }} />
      <CRBig
        variant="dangerFill"
        icon={busy ? undefined : saved ? 'camera' : 'x'}
        disabled={disabled}
        onClick={() => (saved ? onContinue?.() : void submit())}
        right={busy ? <CRSpin color="#fff" /> : null}
      >
        {busy ? 'Enviando…' : saved ? 'Guardado · seguir para a foto' : 'Confirmar não entrega'}
      </CRBig>
      {!code && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-ter)', fontWeight: 600, marginTop: 8 }}>Escolha um motivo</div>}
    </CRSheet>
  )
}
