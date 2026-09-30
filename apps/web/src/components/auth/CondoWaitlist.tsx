import { useId, useState, type ReactNode } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { getStoredReferral } from '../../lib/referral'
import { Icon } from '../brand/Icon'

type IconName = Parameters<typeof Icon>[0]['name']

/** ID anônimo do aparelho (o mesmo `device_id` do analytics) — sem ele, o pedido segue sem. */
function deviceId(): string | undefined {
  try {
    return localStorage.getItem('device_id') ?? undefined
  } catch {
    return undefined
  }
}

/**
 * C8 — Lista de espera (handoff `RefWaitlist`): "Avise-me quando chegar". Chega pelo botão
 * "Meu condomínio não está aqui" do passo "Onde você mora?", já preenchida com o que o cadastro
 * sabe (termo buscado, nome, e-mail). Um campo só para "E-mail ou celular" (D-15) — o servidor
 * descobre qual é. Se o visitante veio por um link de indicação, o código vai junto.
 */
export function CondoWaitlist({
  initial,
  onBack,
  onDone,
}: {
  initial: { condoName: string; contactName: string; contact: string }
  onBack: () => void
  /** "Voltar ao início" depois do sucesso. */
  onDone: () => void
}) {
  const [condoName, setCondoName] = useState(initial.condoName)
  const [zip, setZip] = useState('')
  const [city, setCity] = useState('')
  const [contactName, setContactName] = useState(initial.contactName)
  const [contact, setContact] = useState(initial.contact)
  const [status, setStatus] = useState<'form' | 'sending' | 'error' | 'success'>('form')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [sentWithCode, setSentWithCode] = useState(false)

  const sending = status === 'sending'
  const valid = condoName.trim().length >= 2 && city.trim().length >= 2 && contactName.trim().length >= 2 && contact.trim() !== ''

  const submit = async () => {
    if (!valid || sending) return
    setStatus('sending')
    setErrorText(null)
    const refCode = getStoredReferral()?.code
    try {
      const res = await apiFetch('/condominiums/interest', {
        method: 'POST',
        body: JSON.stringify({
          condoName: condoName.trim(),
          zip: zip.trim() || undefined,
          city: city.trim(),
          contactName: contactName.trim(),
          contact: contact.trim(),
          refCode,
          visitorId: deviceId(),
        }),
      })
      if (!res.ok) {
        // 400 = um campo a ajustar (a mensagem é dele); o resto é falha de envio.
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setErrorText(res.status === 400 && body?.error ? body.error : null)
        setStatus('error')
        return
      }
      setSentWithCode(!!refCode)
      setStatus('success')
    } catch {
      setErrorText(null)
      setStatus('error')
    }
  }

  const back = (
    <button
      type="button"
      onClick={onBack}
      aria-label="Voltar"
      style={{
        cursor: 'pointer',
        background: 'var(--color-surface-2)',
        border: 'none',
        width: 44,
        height: 44,
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        color: 'var(--color-text)',
        flexShrink: 0,
      }}
    >
      <Icon name="arrowL" size={20} />
    </button>
  )

  if (status === 'success') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
          background: 'var(--color-app-bg)',
          padding: '6px 24px 24px',
        }}
      >
        {back}
        <div
          role="status"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 999,
              background: 'var(--color-good-soft)',
              color: 'var(--color-good)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="check" size={40} stroke={2.4} />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              color: 'var(--color-text)',
              margin: '20px 0 0',
              letterSpacing: '-0.03em',
            }}
          >
            Anotado!
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              color: 'var(--color-text-sec)',
              margin: '8px 0 0',
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            Avisamos quando o Cheirin chegar no {condoName.trim()}.{sentWithCode && ' Se veio por indicação, o código fica guardado.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          style={{
            width: '100%',
            minHeight: 44,
            padding: '16px 22px',
            borderRadius: 16,
            border: '1.5px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        padding: '6px 24px 24px',
      }}
    >
      {back}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: '-0.03em',
          color: 'var(--color-text)',
          lineHeight: 1.15,
          margin: '18px 0 0',
        }}
      >
        Avise-me quando chegar
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--color-text-sec)',
          margin: '10px 0 18px',
          lineHeight: 1.5,
        }}
      >
        Leva 30 segundos. Só usamos seu contato pra isso.
      </p>

      <fieldset
        disabled={sending}
        style={{
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
          opacity: sending ? 0.6 : 1,
        }}
      >
        <WaitField label="Nome do condomínio" icon="building" value={condoName} onChange={setCondoName} autoComplete="off" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)',
            gap: 10,
          }}
        >
          <WaitField label="CEP (opcional)" value={zip} onChange={setZip} inputMode="numeric" autoComplete="postal-code" />
          <WaitField label="Cidade" value={city} onChange={setCity} autoComplete="address-level2" />
        </div>
        <WaitField label="Seu nome" icon="user" value={contactName} onChange={setContactName} autoComplete="name" />
        <WaitField
          label="E-mail ou celular"
          icon="mail"
          value={contact}
          onChange={setContact}
          hint="Um dos dois basta."
          autoComplete="email"
        />
      </fieldset>

      {status === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--color-warn-soft)',
            color: 'var(--color-warn)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          <span style={{ flexShrink: 0, display: 'flex' }}>
            <Icon name="alert" size={17} stroke={2.2} />
          </span>
          {errorText ?? 'Não conseguimos enviar agora. Seus dados continuam aqui — tente de novo.'}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!valid || sending}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            minHeight: 44,
            padding: '16px 22px',
            borderRadius: 16,
            border: 'none',
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.01em',
            cursor: !valid || sending ? 'default' : 'pointer',
            opacity: !valid || sending ? 0.45 : 1,
          }}
        >
          {sending ? (
            <>
              <span
                className="cdp-spin"
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 99,
                  border: '2.5px solid rgba(251,243,228,0.3)',
                  borderTopColor: 'var(--color-primary-btn-text)',
                  display: 'inline-block',
                }}
              />
              Enviando…
            </>
          ) : (
            <>
              <Icon name={status === 'error' ? 'refresh' : 'bell'} size={19} stroke={2.2} />
              {status === 'error' ? 'Tentar de novo' : 'Avisar quando chegar'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/** Campo do handoff (`Field`): rótulo, caixa com ícone opcional e dica embaixo. */
function WaitField({
  label,
  icon,
  value,
  onChange,
  hint,
  inputMode,
  autoComplete,
}: {
  label: string
  icon?: IconName
  value: string
  onChange: (v: string) => void
  hint?: ReactNode
  inputMode?: 'numeric' | 'text'
  autoComplete?: string
}) {
  const [focused, setFocused] = useState(false)
  const hintId = useId()
  return (
    <div>
      <label style={{ display: 'block' }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            marginBottom: 7,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--color-surface-alt)',
            border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 14,
            padding: '12px 14px',
            transition: 'border-color .15s',
          }}
        >
          {icon && <Icon name={icon} size={18} color="var(--color-text-ter)" stroke={2} />}
          <input
            value={value}
            inputMode={inputMode}
            autoComplete={autoComplete}
            aria-describedby={hint ? hintId : undefined}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
            }}
          />
        </div>
      </label>
      {hint && (
        <div
          id={hintId}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            color: 'var(--color-text-ter)',
            marginTop: 6,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}
