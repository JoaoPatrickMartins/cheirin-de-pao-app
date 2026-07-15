import { useState } from 'react'
import { passwordIssues } from '@cheirin-de-pao/shared'
import { getDeviceId } from '../../lib/apiFetch'

/**
 * Primitivos visuais compartilhados das telas de autenticação (login, definir/trocar
 * senha, recuperação). Fonte única de estilo — alta fidelidade com o handoff.
 */

// Delega ao getDeviceId do apiFetch: gera + persiste o id na 1ª vez em vez de devolver
// '' quando ainda não existe. Antes, num navegador sem device_id, o corpo do login ia
// com deviceId:'' (readDeviceId roda ANTES do apiFetch gerar o id) e o backend
// respondia 400 (DeviceIdSchema = z.string().min(1)).
export function readDeviceId(): string {
  return getDeviceId()
}

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: '-0.03em',
        color: 'var(--color-text)',
        lineHeight: 1.1,
        margin: 0,
        whiteSpace: 'pre-line',
      }}
    >
      {children}
    </h1>
  )
}

export function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 400,
        color: 'var(--color-text-sec)',
        marginTop: 12,
        marginBottom: 24,
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  )
}

interface TextFieldProps {
  type?: string
  inputMode?: 'email' | 'text'
  autoComplete?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TextField({ type = 'text', inputMode, autoComplete, placeholder, value, onChange, disabled }: TextFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '12px 16px',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 400,
        color: 'var(--color-text)',
        background: 'var(--color-surface-alt)',
        border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-field)',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease',
      }}
    />
  )
}

interface PasswordFieldProps {
  autoComplete?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function PasswordField({ autoComplete, placeholder, value, onChange, disabled }: PasswordFieldProps) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px 48px 12px 16px',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 400,
          color: 'var(--color-text)',
          background: 'var(--color-surface-alt)',
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-field)',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-sec)',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 700,
          padding: '6px 8px',
        }}
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}

interface PrimaryButtonProps {
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}

export function PrimaryButton({ onClick, type = 'button', disabled = false, loading = false, children }: PrimaryButtonProps) {
  const [hovered, setHovered] = useState(false)
  const isDisabled = disabled || loading

  return (
    <button
      onClick={onClick}
      type={type}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 52,
        backgroundColor: 'var(--color-espresso)',
        color: 'var(--color-primary-btn-text)',
        borderRadius: 'var(--radius-btn)',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        padding: '16px 24px',
        border: 'none',
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        transition: 'transform 0.15s, filter 0.15s, opacity 0.15s',
        transform: hovered && !isDisabled ? 'translateY(-1px)' : 'translateY(0)',
        filter: hovered && !isDisabled ? 'brightness(1.05)' : 'none',
        boxSizing: 'border-box',
      }}
    >
      {loading ? 'Carregando...' : children}
    </button>
  )
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--color-accent)',
        padding: 4,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </button>
  )
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--color-accent)',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  )
}

// Critérios de senha forte (visual). A validade autoritativa vem de passwordIssues().
const CRITERIA: { label: string; test: (p: string) => boolean }[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Uma letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Uma letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Um número', test: (p) => /\d/.test(p) },
]

/** Verdadeiro quando a senha atende à política (fonte única: passwordIssues). */
export function isPasswordStrong(password: string): boolean {
  return passwordIssues(password).length === 0
}

/** Checklist visual dos critérios de senha, marcando cada regra atendida. */
export function PasswordCriteria({ password }: { password: string }) {
  return (
    <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {CRITERIA.map((c) => {
        const ok = c.test(password)
        return (
          <li
            key={c.label}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: ok ? 'var(--color-success, #2e7d32)' : 'var(--color-text-sec)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span aria-hidden style={{ fontWeight: 800 }}>{ok ? '✓' : '○'}</span>
            {c.label}
          </li>
        )
      })}
    </ul>
  )
}
