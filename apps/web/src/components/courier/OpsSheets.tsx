import { useState } from 'react'
import { ACCESS_FIELDS, ACCESS_FIELD_LABELS, RECADO_TEMPLATES, STOP_ISSUE_LABELS, STOP_ISSUE_TYPES, type AccessField, type StopIssueType } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { CRBig, CRChoice, CRNote, CRSheet, CRSpin, CRTextarea } from './kit'

/** Resultado de uma ação da operação, do ponto de vista da tela. */
export type OpsSendResult = { kind: 'sent'; at?: string } | { kind: 'saved' } | { kind: 'error'; error: string; code?: string }

const hhmm = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n
const where = (s: { apartment: string; block: string | null }) => [s.apartment ? `Apto ${s.apartment}` : null, s.block ? `Bloco ${s.block}` : null].filter(Boolean).join(' · ')

/**
 * E16 · Mandar recado: modelos prontos (sem texto livre), 1 por modelo/cliente/dia. O cliente
 * recebe como notificação; o telefone do entregador não aparece.
 */
export function RecadoSheet({
  stop,
  onSend,
  onClose,
}: {
  stop: { clientName: string; apartment: string; block: string | null; messagesOff?: boolean }
  onSend: (template: string) => Promise<OpsSendResult>
  onClose: () => void
}) {
  const [sel, setSel] = useState<string>(RECADO_TEMPLATES[0].key)
  const [state, setState] = useState<'pick' | 'sending' | 'sent' | 'saved'>('pick')
  const [sentAt, setSentAt] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [optOut, setOptOut] = useState(!!stop.messagesOff)
  const done = state === 'sent' || state === 'saved'

  const send = async () => {
    setState('sending')
    setError(null)
    const r = await onSend(sel)
    if (r.kind === 'sent') {
      setSentAt(r.at)
      setState('sent')
    } else if (r.kind === 'saved') setState('saved')
    else {
      setState('pick')
      if (r.code === 'OPT_OUT') setOptOut(true)
      else setError(r.code === 'ALREADY' ? 'Este recado já foi enviado hoje para este cliente.' : r.error)
    }
  }

  return (
    <CRSheet title="Mandar recado" sub={`${firstName(stop.clientName)} · ${where(stop)}`} onClose={onClose} busy={state === 'sending'}>
      {optOut && (
        <CRNote icon="bell" tone="gold" style={{ marginBottom: 12 }}>
          {firstName(stop.clientName)} desligou os recados do entregador. Se precisar, fale com a operação.
        </CRNote>
      )}
      <div role="radiogroup" aria-label="Recado" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {RECADO_TEMPLATES.map((r) => (
          <CRChoice key={r.key} icon="chat" on={!optOut && sel === r.key} disabled={optOut || done} onClick={() => setSel(r.key)}>
            {r.text}
          </CRChoice>
        ))}
      </div>
      {state === 'sent' && (
        <CRNote icon="check" tone="good" style={{ marginTop: 12 }}>
          Recado enviado às {hhmm(sentAt)}
        </CRNote>
      )}
      {state === 'saved' && (
        <CRNote icon="cloudOff" tone="gold" style={{ marginTop: 12 }}>
          Sem sinal agora. O recado sai assim que o sinal voltar.
        </CRNote>
      )}
      {error && (
        <CRNote tone="danger" style={{ marginTop: 12 }}>
          {error}
        </CRNote>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600, margin: '12px 2px 14px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="lock" size={13} aria-hidden="true" />O cliente recebe como notificação. Seu telefone não aparece.
      </div>
      {done ? (
        <CRBig variant="ghost" onClick={onClose}>
          Pronto
        </CRBig>
      ) : (
        <CRBig icon={state === 'sending' ? undefined : 'send'} disabled={optOut || state === 'sending'} right={state === 'sending' ? <CRSpin color="var(--color-gold)" /> : null} onClick={() => void send()}>
          {state === 'sending' ? 'Enviando…' : 'Enviar recado'}
        </CRBig>
      )}
    </CRSheet>
  )
}

/**
 * E11 · Reportar problema numa entrega realizada. A entrega não é desfeita: a operação recebe o
 * aviso e resolve (marca não entregue ou mantém).
 */
export function ReportSheet({
  stop,
  onSend,
  onClose,
}: {
  stop: { clientName: string; apartment: string; block: string | null; time?: string | null }
  onSend: (type: StopIssueType, text: string) => Promise<OpsSendResult>
  onClose: () => void
}) {
  const [type, setType] = useState<StopIssueType | null>(null)
  const [text, setText] = useState('')
  const [state, setState] = useState<'form' | 'sending'>('form')
  const [error, setError] = useState<string | null>(null)
  const needText = type === 'OUTRO' && text.trim().length < 3

  const send = async () => {
    if (!type) return
    if (needText) return setError('Conte o que aconteceu')
    setState('sending')
    setError(null)
    const r = await onSend(type, text)
    setState('form')
    if (r.kind === 'error') setError(r.error)
  }

  return (
    <CRSheet title="Reportar problema" sub={[where(stop), stop.clientName, stop.time].filter(Boolean).join(' · ')} onClose={onClose} busy={state === 'sending'}>
      <div role="radiogroup" aria-label="Problema" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STOP_ISSUE_TYPES.map((t) => (
          <CRChoice key={t} on={type === t} onClick={() => setType(t)}>
            {STOP_ISSUE_LABELS[t]}
          </CRChoice>
        ))}
      </div>
      <CRTextarea
        value={text}
        onChange={setText}
        label="O que aconteceu"
        placeholder={type === 'OUTRO' ? 'Conte o que aconteceu' : 'Conte o que aconteceu (opcional)'}
        error={error && type === 'OUTRO' ? error : null}
        style={{ marginTop: 10 }}
      />
      <CRNote icon="alert" style={{ marginTop: 12 }}>
        A entrega não é desfeita. A operação recebe o aviso e resolve.
      </CRNote>
      {error && type !== 'OUTRO' && (
        <CRNote tone="danger" style={{ marginTop: 10 }}>
          {error}
        </CRNote>
      )}
      <div style={{ height: 16 }} />
      <CRBig icon={state === 'sending' ? undefined : 'send'} disabled={!type || state === 'sending'} right={state === 'sending' ? <CRSpin color="var(--color-gold)" /> : null} onClick={() => void send()}>
        {state === 'sending' ? 'Enviando…' : 'Enviar para a operação'}
      </CRBig>
    </CRSheet>
  )
}

/** E7 · "Sugerir correção" do acesso do prédio — vai para a revisão do admin (A6). */
export function AccessSuggestSheet({
  condoName,
  onSend,
  onClose,
}: {
  condoName: string
  onSend: (field: AccessField, text: string) => Promise<OpsSendResult>
  onClose: () => void
}) {
  const [field, setField] = useState<AccessField>('PORTAO')
  const [text, setText] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'sent'>('form')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (text.trim().length < 3) return setError('Escreva a sugestão')
    setState('sending')
    setError(null)
    const r = await onSend(field, text.trim())
    if (r.kind === 'sent' || r.kind === 'saved') setState('sent')
    else {
      setState('form')
      setError(r.error)
    }
  }

  return (
    <CRSheet title="Sugerir correção" sub={`${condoName} · acesso`} onClose={onClose} busy={state === 'sending'}>
      <div role="radiogroup" aria-label="O que corrigir" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ACCESS_FIELDS.map((f) => (
          <CRChoice key={f} on={field === f} disabled={state === 'sent'} onClick={() => setField(f)}>
            {ACCESS_FIELD_LABELS[f]}
          </CRChoice>
        ))}
      </div>
      <CRTextarea value={text} onChange={setText} label="Sugestão" placeholder="Ex.: o interfone agora é 9, não 0" error={error} style={{ marginTop: 10 }} maxLength={300} />
      {state === 'sent' && (
        <CRNote icon="check" tone="good" style={{ marginTop: 12 }}>
          Sugestão enviada. A operação revisa e atualiza o acesso.
        </CRNote>
      )}
      <div style={{ height: 16 }} />
      {state === 'sent' ? (
        <CRBig variant="ghost" onClick={onClose}>
          Pronto
        </CRBig>
      ) : (
        <CRBig icon={state === 'sending' ? undefined : 'send'} disabled={state === 'sending'} right={state === 'sending' ? <CRSpin color="var(--color-gold)" /> : null} onClick={() => void send()}>
          {state === 'sending' ? 'Enviando…' : 'Enviar sugestão'}
        </CRBig>
      )}
    </CRSheet>
  )
}
