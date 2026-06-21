import { useState, useCallback } from 'react'
import {
  CardNumber,
  ExpirationDate,
  SecurityCode,
  createCardToken,
  getPaymentMethods,
  getIssuers,
} from '@mercadopago/sdk-react'
import { useAuth } from '../../hooks/useAuth'
import { CardBrandBadge } from './CardBrandBadge'

const FIELD_H = 52

// Estilo do texto DENTRO dos iframes do Secure Fields. Não cruza CSS vars (iframe é
// outro documento), então usamos valores concretos equivalentes aos tokens do app.
const fieldTextStyle = {
  height: `${FIELD_H}px`,
  fontSize: '15px',
  color: '#241608', // --color-text
  placeholderColor: '#A89A82', // --color-text-ter
}

export interface AddCardPayload {
  token: string
  paymentMethodId: string | null
  issuerId: string | null
  payerIdentification: { type: 'CPF'; number: string }
}

interface AddCardFormProps {
  submitLabel: string
  /** Faz a chamada de API com o token. Retorna mensagem de erro, ou null em sucesso. */
  onSubmit: (payload: AddCardPayload) => Promise<string | null>
  note?: string
}

/**
 * Formulário de cartão via Secure Fields do Mercado Pago — usado tanto para salvar um
 * cartão avulso quanto para pagar (e salvar) com um cartão novo. Encapsula a lógica
 * sensível de montagem: os callbacks PRECISAM ser estáveis (useCallback), senão o
 * useEffect interno dos Secure Fields remonta o iframe a cada render e trava a digitação.
 */
export function AddCardForm({ submitLabel, onSubmit, note }: AddCardFormProps) {
  const { user } = useAuth()

  const [holderName, setHolderName] = useState('')
  const [useAccountCpf, setUseAccountCpf] = useState(true)
  const [cpfManual, setCpfManual] = useState('')
  const [fieldsReady, setFieldsReady] = useState(0)
  const [brand, setBrand] = useState<string | null>(null) // paymentMethodId detectado
  const [issuerId, setIssuerId] = useState<string | null>(null)
  // Validade de cada campo do cartão (via onValidityChange). Essencial: o MP tokeniza até
  // um CVV de 3 dígitos em AMEX (que exige 4), e só o Payment.create recusa — gerando erro 500.
  const [valid, setValid] = useState({ cardNumber: false, expirationDate: false, securityCode: false })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleFieldReady = useCallback(() => setFieldsReady((n) => n + 1), [])

  const handleValidity = useCallback((arg: { field: string; errorMessages: unknown[] }) => {
    setValid((v) => ({ ...v, [arg.field]: arg.errorMessages.length === 0 }))
  }, [])

  // Detecta bandeira + issuer a partir do BIN (primeiros dígitos)
  const handleBinChangeArg = useCallback(async (arg: { bin?: string }) => {
    const bin = arg.bin
    if (!bin) {
      setBrand(null)
      setIssuerId(null)
      return
    }
    try {
      const pm = await getPaymentMethods({ bin })
      const pmId = pm?.results?.[0]?.id ?? null
      setBrand(pmId)
      if (pmId) {
        const issuers = await getIssuers({ paymentMethodId: pmId, bin })
        setIssuerId(issuers?.[0]?.id ?? null)
      } else {
        setIssuerId(null)
      }
    } catch {
      setBrand(null)
      setIssuerId(null)
    }
  }, [])

  const handleSubmit = async () => {
    if (saving) return
    setFormError(null)

    if (holderName.trim().length < 2) {
      setFormError('Informe o nome impresso no cartão.')
      return
    }
    const cpf = (useAccountCpf ? user?.cpf ?? '' : cpfManual).replace(/\D/g, '')
    if (cpf.length !== 11) {
      setFormError('Informe um CPF válido (11 dígitos).')
      return
    }
    if (!valid.cardNumber || !valid.expirationDate || !valid.securityCode) {
      setFormError('Confira o número, a validade e o CVV do cartão.')
      return
    }

    setSaving(true)
    try {
      const token = await createCardToken({
        cardholderName: holderName.trim(),
        identificationType: 'CPF',
        identificationNumber: cpf,
      })
      if (!token?.id) {
        setFormError('Verifique os dados do cartão e tente novamente.')
        return
      }
      const error = await onSubmit({
        token: token.id,
        paymentMethodId: brand,
        issuerId,
        payerIdentification: { type: 'CPF', number: cpf },
      })
      if (error) setFormError(error)
    } catch {
      setFormError('Verifique os dados do cartão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const formReady = fieldsReady >= 3

  return (
    <div>
      {note && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '0 0 16px' }}>
          {note}
        </p>
      )}

      <FieldLabel>Número do cartão</FieldLabel>
      <SecureFieldShell trailing={<CardBrandBadge brand={brand} />}>
        <CardNumber
          placeholder="0000 0000 0000 0000"
          style={fieldTextStyle}
          onReady={handleFieldReady}
          onBinChange={handleBinChangeArg}
          onValidityChange={handleValidity}
        />
      </SecureFieldShell>
      <div style={{ height: 16 }} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel>Validade</FieldLabel>
          <SecureFieldShell>
            <ExpirationDate
              placeholder="MM/AA"
              mode="short"
              style={fieldTextStyle}
              onReady={handleFieldReady}
              onValidityChange={handleValidity}
            />
          </SecureFieldShell>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel>CVV</FieldLabel>
          <SecureFieldShell trailing={<CvvIcon />}>
            <SecurityCode
              placeholder="123"
              style={fieldTextStyle}
              onReady={handleFieldReady}
              onValidityChange={handleValidity}
            />
          </SecureFieldShell>
        </div>
      </div>
      <div style={{ height: 16 }} />

      <FieldLabel>Nome impresso no cartão</FieldLabel>
      <input
        type="text"
        value={holderName}
        onChange={(e) => setHolderName(e.target.value)}
        placeholder="Ex: João P Martins"
        autoComplete="cc-name"
        style={inputStyle}
      />
      <div style={{ height: 16 }} />

      <FieldLabel>E-mail da conta</FieldLabel>
      <input
        type="text"
        value={user?.email ?? ''}
        readOnly
        style={{ ...inputStyle, opacity: 0.7, background: 'var(--color-surface-2)', cursor: 'not-allowed' }}
      />
      <div style={{ height: 16 }} />

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: user?.cpf ? 'pointer' : 'not-allowed',
          minHeight: 44,
        }}
      >
        <input
          type="checkbox"
          checked={useAccountCpf}
          disabled={!user?.cpf}
          onChange={(e) => setUseAccountCpf(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--color-accent)', cursor: 'inherit' }}
        />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)' }}>
          Usar meu CPF cadastrado {user?.cpf ? `(${user.cpf})` : ''}
        </span>
      </label>

      {!useAccountCpf && (
        <>
          <div style={{ height: 8 }} />
          <FieldLabel>CPF do titular</FieldLabel>
          <input
            type="text"
            inputMode="numeric"
            value={cpfManual}
            onChange={(e) => setCpfManual(e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="Somente números"
            style={inputStyle}
          />
        </>
      )}

      {formError && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#C0392B', margin: '16px 0 0' }}>{formError}</p>
      )}

      <div style={{ height: 20 }} />
      <button
        onClick={() => void handleSubmit()}
        disabled={saving || !formReady}
        style={{
          width: '100%',
          height: 52,
          background: 'var(--color-espresso)',
          color: 'var(--color-primary-btn-text)',
          borderRadius: 'var(--radius-btn)',
          border: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          cursor: saving || !formReady ? 'not-allowed' : 'pointer',
          opacity: saving || !formReady ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? 'Processando...' : formReady ? submitLabel : 'Carregando...'}
      </button>
    </div>
  )
}

// ── Sub-components & styles ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 'var(--radius-field)',
  padding: '12px 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

/**
 * Caixa que envolve cada iframe do Secure Fields. CRÍTICO: o iframe do Mercado Pago
 * preenche a ALTURA do seu container direto — por isso o wrapper interno tem altura
 * explícita (FIELD_H). Sem isso o iframe colapsa para 0px e fica impossível digitar.
 */
function SecureFieldShell({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div
      style={{
        height: FIELD_H,
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-field)',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, height: FIELD_H }}>{children}</div>
      {trailing && <span style={{ display: 'flex', flexShrink: 0 }}>{trailing}</span>}
    </div>
  )
}

// Ícone do CVV — cartão com os três dígitos destacados (referência visual do código)
function CvvIcon() {
  return (
    <svg width="34" height="22" viewBox="0 0 34 22" fill="none" aria-hidden>
      <rect x="1" y="1" width="32" height="20" rx="3.5" stroke="var(--color-text-ter)" strokeWidth="1.5" />
      <rect x="19" y="6.5" width="12" height="9" rx="2" fill="var(--color-surface-2)" />
      <circle cx="22.5" cy="11" r="1.1" fill="var(--color-text-sec)" />
      <circle cx="25.5" cy="11" r="1.1" fill="var(--color-text-sec)" />
      <circle cx="28.5" cy="11" r="1.1" fill="var(--color-text-sec)" />
    </svg>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--color-text-sec)',
        margin: '0 0 8px',
      }}
    >
      {children}
    </p>
  )
}
