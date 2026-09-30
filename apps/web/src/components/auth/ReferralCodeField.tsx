import { useCallback, useEffect, useRef, useState } from 'react'
import { breadsLabel, normalizeReferralCode } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { apiFetch } from '../../lib/apiFetch'
import { checkReferralCode, getStoredReferral } from '../../lib/referral'

/**
 * C4 — código de indicação no passo 1 do cadastro. Handoff: `RefBadge`, `RefCodeField` e
 * `RegisterReferral` (screens-referral2.jsx).
 *
 * Regra que manda em tudo aqui: **a indicação nunca atrapalha o cadastro**. Programa desligado →
 * nada aparece. Código errado → aviso suave, e o Continuar segue livre. O botão só espera
 * enquanto o código está sendo conferido.
 */

export type ReferralFieldStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'unknown'

export interface SignupReferral {
  /** Programa ligado (null enquanto `GET /referrals/config` não respondeu). */
  active: boolean
  /** Veio pelo link e o código confere — o selo sobe para acima do título. */
  linked: { code: string; referrerName: string; welcomeBreads: number } | null
  fieldOpen: boolean
  value: string
  status: ReferralFieldStatus
  checked: { referrerName: string; welcomeBreads: number } | null
  openField: () => void
  setValue: (v: string) => void
  validate: () => Promise<void>
  /** O que vai no `POST /auth/register` (vazio quando não há código a mandar). */
  payload: () => { referralCode?: string; referralSource?: 'LINK' | 'CODE' }
}

export function useSignupReferral(): SignupReferral {
  const [active, setActive] = useState(false)
  const [linked, setLinked] = useState<SignupReferral['linked']>(null)
  const [fieldOpen, setFieldOpen] = useState(false)
  const [value, setValueState] = useState('')
  const [status, setStatus] = useState<ReferralFieldStatus>('idle')
  const [checked, setChecked] = useState<SignupReferral['checked']>(null)
  // Última validação feita — sair do campo sem mudar nada não confere de novo.
  const lastChecked = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/referrals/config')
        if (!res.ok || cancelled) return
        const cfg = (await res.json()) as { active?: boolean }
        if (!cfg.active || cancelled) return
        setActive(true)
        // Veio pelo link? Confere antes de mostrar "Indicado por…": código de conta bloqueada
        // (ou que não existe mais) não pode aparecer como indicação.
        const stored = getStoredReferral()
        if (!stored) return
        const check = await checkReferralCode(stored.code)
        if (cancelled || !check?.valid) return
        setLinked({ code: stored.code, referrerName: check.referrerName ?? '', welcomeBreads: check.welcomeBreads ?? 0 })
      } catch {
        // Sem config = sem campo. O cadastro segue normal.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openField = useCallback(() => {
    setFieldOpen(true)
    // "Trocar": abre o campo JÁ com o código do link, conferido.
    if (linked) {
      setValueState(linked.code)
      setStatus('valid')
      setChecked({ referrerName: linked.referrerName, welcomeBreads: linked.welcomeBreads })
      lastChecked.current = linked.code
    }
  }, [linked])

  const setValue = useCallback((v: string) => {
    // Maiúsculas automáticas, sem espaço nem hífen — como o código aparece na mensagem.
    const next = normalizeReferralCode(v).slice(0, 20)
    setValueState(next)
    if (next !== lastChecked.current) {
      setStatus('idle')
      setChecked(null)
    }
  }, [])

  const validate = useCallback(async () => {
    const code = normalizeReferralCode(value)
    if (!code) {
      setStatus('idle')
      setChecked(null)
      lastChecked.current = null
      return
    }
    if (code === lastChecked.current) return
    setStatus('validating')
    const check = await checkReferralCode(code)
    lastChecked.current = code
    if (check === null) {
      // Não deu para conferir (rede). Manda assim mesmo — o servidor decide no cadastro.
      setStatus('unknown')
      setChecked(null)
      return
    }
    setStatus(check.valid ? 'valid' : 'invalid')
    setChecked(check.valid ? { referrerName: check.referrerName ?? '', welcomeBreads: check.welcomeBreads ?? 0 } : null)
  }, [value])

  const payload = useCallback((): ReturnType<SignupReferral['payload']> => {
    if (!active) return {}
    if (!fieldOpen) return linked ? { referralCode: linked.code, referralSource: 'LINK' } : {}
    const code = normalizeReferralCode(value)
    if (!code || status === 'invalid') return {}
    // O código do link, conferido e sem troca, continua sendo "LINK" — é o que o funil mede.
    const source = linked && code === linked.code ? 'LINK' : 'CODE'
    return { referralCode: code, referralSource: source }
  }, [active, fieldOpen, linked, value, status])

  return { active, linked, fieldOpen, value, status, checked, openField, setValue, validate, payload }
}

/** Selo "Indicado por João M." (+ o bônus, quando há). `onChange` mostra o "Trocar". */
export function ReferralBadge({
  referrerName,
  welcomeBreads,
  onChange,
}: {
  referrerName: string
  welcomeBreads: number
  onChange?: () => void
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '12px 12px 12px 14px',
        borderRadius: 18,
        background: 'var(--color-gold-soft)',
        border: '1px solid rgba(176,112,42,0.22)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: 'var(--color-gold)',
          color: 'var(--color-espresso)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="gift" size={19} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>Indicado por {referrerName}</div>
        {welcomeBreads > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--color-accent)', fontWeight: 600, marginTop: 2, lineHeight: 1.35 }}>
            Você ganha {breadsLabel(welcomeBreads)} quando o 1º pedido chegar
          </div>
        )}
      </div>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          style={{
            minHeight: 44,
            padding: '0 6px',
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Trocar
        </button>
      )}
    </div>
  )
}

/** "Tenho um código de indicação" — abre o campo. */
export function ReferralCodeToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        minHeight: 44,
        padding: 0,
        background: 'none',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--color-accent)',
        fontWeight: 700,
        fontSize: 13.5,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Icon name="ticket" size={17} />
      Tenho um código de indicação
    </button>
  )
}

/** O campo do código, com os estados do handoff. Valida ao sair do campo. */
export function ReferralCodeField({ referral }: { referral: SignupReferral }) {
  const [focused, setFocused] = useState(false)
  const { value, status, checked } = referral
  const ok = status === 'valid'
  const border = ok
    ? 'var(--color-good)'
    : status === 'invalid' || focused
      ? 'var(--color-accent)'
      : 'var(--color-border)'
  const hintId = 'referral-code-hint'

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <label htmlFor="referral-code" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>
        Código de indicação <span style={{ fontWeight: 600, color: 'var(--color-text-ter)' }}>(opcional)</span>
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt)',
          border: `1.5px solid ${border}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color .15s',
        }}
      >
        <Icon name="ticket" size={18} color="var(--color-text-ter)" stroke={2} />
        <input
          id="referral-code"
          value={value}
          onChange={(e) => referral.setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            void referral.validate()
          }}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={20}
          placeholder="Ex.: JOAO7K2F"
          aria-invalid={status === 'invalid'}
          aria-describedby={hintId}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        />
        {status === 'validating' && (
          <span
            className="cdp-spin"
            aria-hidden="true"
            style={{
              width: 18,
              height: 18,
              borderRadius: 99,
              border: '2.5px solid var(--color-gold-soft)',
              borderTopColor: 'var(--color-accent)',
              flexShrink: 0,
            }}
          />
        )}
        {ok && <Icon name="check" size={19} color="var(--color-good)" stroke={2.6} />}
      </div>

      <div id={hintId} aria-live="polite">
        {status === 'idle' && (
          <div style={{ fontSize: 11.5, color: 'var(--color-text-ter)', marginTop: 6 }}>Letras e números, como está na mensagem do seu amigo.</div>
        )}
        {status === 'validating' && (
          <div style={{ fontSize: 11.5, color: 'var(--color-text-ter)', marginTop: 6 }}>Conferindo o código…</div>
        )}
        {status === 'invalid' && (
          <div
            role="alert"
            style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--color-accent)', marginTop: 7, lineHeight: 1.4, fontWeight: 600 }}
          >
            <span style={{ flexShrink: 0, marginTop: 1, display: 'grid' }}>
              <Icon name="alert" size={15} stroke={2.2} />
            </span>
            Não achamos esse código. Confira as letras — ou siga sem ele, sem problema.
          </div>
        )}
      </div>
      {ok && checked && (
        <div style={{ marginTop: 10 }}>
          <ReferralBadge referrerName={checked.referrerName} welcomeBreads={checked.welcomeBreads} />
        </div>
      )}
    </div>
  )
}
