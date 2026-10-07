import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { INCIDENT_LABELS, INCIDENT_TYPES, type IncidentType } from '@cheirin-de-pao/shared'
import { Icon, type Ic } from '../../components/brand/Icon'
import { CRBig, CRLabel, CRNote, CRSpin, CRTextarea } from '../../components/courier/kit'
import { CourierPage, CRCard } from '../../components/courier/CourierPage'
import type { OpsSendResult } from '../../components/courier/OpsSheets'
import { supportWhatsappUrl } from '../../lib/support'

const ICONS: Record<IncidentType, keyof typeof Ic> = { ATRASO: 'clock', VEICULO: 'moto', ACIDENTE: 'alert', PEDIDO_FALTANDO: 'box', OUTRO: 'edit' }
const hhmm = (iso?: string) => new Date(iso ?? Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/**
 * E12 · Falar com a operação: o WhatsApp da operação (H-4) e "Registrar ocorrência" (atraso,
 * veículo, acidente, pedido faltando) com foto opcional. Sem sinal, a ocorrência fica guardada e
 * sai sozinha.
 */
export function CourierOps({ onClose, onSend }: { onClose: () => void; onSend: (type: IncidentType, text: string, photo: Blob | null) => Promise<OpsSendResult> }) {
  const [type, setType] = useState<IncidentType | null>(null)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [state, setState] = useState<'form' | 'sending' | 'sent' | 'saved'>('form')
  const [sentAt, setSentAt] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const small = await imageCompression(file, { maxSizeMB: 0.6, maxWidthOrHeight: 1280, useWebWorker: true })
      setPhoto(small)
      setPreview(URL.createObjectURL(small))
    } catch {
      setError('Não deu para usar esta foto. Tente outra.')
    }
  }

  const send = async () => {
    if (!type) return setError('Escolha o tipo da ocorrência')
    if (type === 'OUTRO' && text.trim().length < 3) return setError('Conte o que aconteceu')
    setState('sending')
    setError(null)
    const r = await onSend(type, text, photo)
    if (r.kind === 'sent') {
      setSentAt(r.at)
      setState('sent')
    } else if (r.kind === 'saved') setState('saved')
    else {
      setState('form')
      setError(r.error)
    }
  }

  const done = state === 'sent' || state === 'saved'
  return (
    <CourierPage title="Falar com a operação" onBack={onClose}>
      <CRCard>
        <a
          href={supportWhatsappUrl('Olá! Sou entregador e preciso falar com a operação.')}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 16, textDecoration: 'none', color: 'inherit' }}
        >
          <span style={{ width: 48, height: 48, borderRadius: 15, background: 'var(--color-good-soft)', color: 'var(--color-good)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="chat" size={24} aria-hidden="true" />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>Chamar no WhatsApp</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-sec)' }}>WhatsApp da operação</span>
          </span>
          <Icon name="external" size={18} color="var(--color-text-ter)" aria-hidden="true" />
        </a>
      </CRCard>

      <div>
        <CRLabel style={{ marginTop: 8 }}>Registrar ocorrência</CRLabel>
        <div role="radiogroup" aria-label="Tipo da ocorrência" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INCIDENT_TYPES.map((t) => {
            const on = type === t
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={done}
                onClick={() => setType(t)}
                style={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '0 14px',
                  borderRadius: 14,
                  border: `2px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`,
                  background: on ? 'var(--color-text)' : 'var(--color-surface)',
                  color: on ? 'var(--color-app-bg)' : 'var(--color-text)',
                  fontWeight: 800,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <Icon name={ICONS[t]} size={16} stroke={2.3} aria-hidden="true" />
                {INCIDENT_LABELS[t]}
              </button>
            )
          })}
        </div>
      </div>

      <CRTextarea value={text} onChange={setText} label="O que aconteceu" placeholder="Conte o que aconteceu" maxLength={500} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {preview && <img src={preview} alt="Foto da ocorrência" style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover' }} />}
        <button
          type="button"
          aria-label={preview ? 'Trocar a foto' : 'Adicionar foto'}
          disabled={done}
          onClick={() => fileRef.current?.click()}
          style={{ width: 72, height: 72, borderRadius: 14, border: '2px dashed var(--color-border)', background: 'transparent', color: 'var(--color-accent)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <Icon name="camera" size={24} aria-hidden="true" />
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 600 }}>Foto opcional</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Foto da ocorrência"
          style={{ display: 'none' }}
          onChange={(e) => {
            void pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {state === 'sent' && (
        <CRNote icon="check" tone="good">
          Ocorrência enviada às {hhmm(sentAt)}. A operação já recebeu.
        </CRNote>
      )}
      {state === 'saved' && (
        <CRNote icon="cloudOff" tone="gold">
          Sem sinal agora. Guardamos a ocorrência e enviamos sozinhos.
        </CRNote>
      )}
      {error && <CRNote tone="danger">{error}</CRNote>}

      <CRBig
        icon={state === 'sending' ? undefined : done ? 'check' : 'send'}
        disabled={state === 'sending' || done}
        right={state === 'sending' ? <CRSpin color="var(--color-gold)" /> : null}
        onClick={() => void send()}
      >
        {state === 'sending' ? 'Enviando…' : done ? 'Enviada' : 'Enviar'}
      </CRBig>
    </CourierPage>
  )
}
