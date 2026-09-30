import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '../brand/Icon'
import { copyText } from '../../lib/referral'

/**
 * Kit do login com Google — alta fidelidade com o handoff
 * (.projeto/design_handoff_login_social/design/app/screens-social-auth.jsx).
 * Os tokens do handoff (`useT()`) mapeiam para as variáveis de `styles/globals.css`.
 *
 * Exceção de marca: o botão e o logo do Google seguem a diretriz do Google (branco, borda
 * #747775, texto #1F1F1F, Roboto Medium, "G" multicolor) — não usam os tokens do app.
 */

export const SOCIAL_NAMES = { google: 'Google' } as const
export type SocialProviderName = keyof typeof SOCIAL_NAMES

const DISPLAY = 'var(--font-display)'
const BODY = 'var(--font-body)'

/** Animações da feature (spinner, "respiração" do L3a, entrada dos avisos). */
export function SocialKeyframes() {
  return (
    <style>
      {'@keyframes saSpin{to{transform:rotate(360deg)}}@keyframes saBreath{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.82}}@keyframes saRise{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}'}
    </style>
  )
}

/* ---------- Logo oficial (não alterar cores nem proporção) ---------- */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** Tile quadrado com o logo (listas, cards, cantos de ícone). */
export function ProviderTile({ size = 40, radius = 12 }: { size?: number; radius?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: '#FFFFFF',
        border: '1px solid var(--color-border)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <GoogleG size={Math.round(size * 0.5)} />
    </div>
  )
}

export function Spinner({ size = 18, color = 'currentColor', track = 'rgba(0,0,0,0.12)' }: { size?: number; color?: string; track?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        border: `2.5px solid ${track}`,
        borderTopColor: color,
        animation: 'saSpin .8s linear infinite',
        flexShrink: 0,
        display: 'inline-block',
        boxSizing: 'border-box',
      }}
    />
  )
}

/* ---------- Botão do Google ----------
   Branco, borda #747775, texto #1F1F1F, Roboto Medium 15,5 (diretriz do Google). 54 px, raio 16. */
export function GoogleButton({
  state = 'idle',
  onClick,
}: {
  state?: 'idle' | 'loading' | 'disabled'
  onClick?: () => void
}) {
  const loading = state === 'loading'
  const disabled = state === 'disabled'
  return (
    <button
      type="button"
      onClick={loading || disabled ? undefined : onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      style={{
        width: '100%',
        minHeight: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 18px',
        borderRadius: 16,
        cursor: loading || disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity .15s',
        background: '#FFFFFF',
        color: '#1F1F1F',
        border: '1px solid #747775',
        fontFamily: 'Roboto, "Hanken Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: 15.5,
        letterSpacing: '0.01em',
      }}
    >
      {loading ? <Spinner size={19} color="#4285F4" track="#E3E3E3" /> : <GoogleG size={20} />}
      <span>{loading ? 'Abrindo o Google…' : 'Continuar com o Google'}</span>
    </button>
  )
}

/** No lugar do botão do Google dentro do navegador do Instagram/Facebook (o Google bloqueia). */
export function InAppNotice() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (await copyText(window.location.href)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }
  return (
    <div
      role="note"
      style={{
        borderRadius: 16,
        border: '1.5px dashed var(--color-border)',
        background: 'var(--color-surface)',
        padding: '13px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <ProviderTile size={36} radius={11} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>
          Para entrar com o Google, abra no navegador
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 3, lineHeight: 1.45 }}>
          O Google não deixa entrar por aqui. Toque em <b style={{ color: 'var(--color-text)' }}>•••</b> e em “Abrir no navegador” — ou copie o link.
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: BODY,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? 'var(--color-good)' : 'currentColor'} stroke={2.2} />
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  )
}

export function OrDivider({ label = 'ou com e-mail' }: { label?: string }) {
  return (
    <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      <span style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, color: 'var(--color-text-ter)', letterSpacing: '0.02em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  )
}

/** "Ao continuar, você concorda…" — abaixo dos botões do Google (L1 e L2). */
export function Consent({ style }: { style?: CSSProperties }) {
  const a: CSSProperties = { color: 'var(--color-accent)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }
  return (
    <div style={{ fontFamily: BODY, fontSize: 12, color: 'var(--color-text-ter)', lineHeight: 1.5, textAlign: 'center', textWrap: 'pretty', ...style }}>
      Ao continuar, você concorda com os <Link to="/termos" style={a}>Termos de Uso</Link> e a{' '}
      <Link to="/privacidade" style={a}>Política de Privacidade</Link>.
    </div>
  )
}

/** Card do provedor com o e-mail travado (cadastro "Quase lá"). */
export function ProviderPill({ email }: { email: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        padding: '11px 14px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <ProviderTile size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: 'var(--color-text-sec)', marginTop: 1 }}>via Google · e-mail confirmado</div>
      </div>
      <Icon name="lock" size={17} color="var(--color-text-ter)" />
    </div>
  )
}

/** Aviso (nunca culpa o cliente). tone: warn (dourado) · danger · good. */
export function Notice({
  title,
  children,
  tone = 'warn',
  action,
}: {
  title?: ReactNode
  children?: ReactNode
  tone?: 'warn' | 'danger' | 'good'
  action?: ReactNode
}) {
  const c = tone === 'danger' ? 'var(--color-warn)' : tone === 'good' ? 'var(--color-good)' : 'var(--color-accent)'
  const bg = tone === 'danger' ? 'var(--color-warn-soft)' : tone === 'good' ? 'var(--color-good-soft)' : 'var(--color-gold-soft)'
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 16, background: bg, animation: 'saRise .25s ease' }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>
        <Icon name={tone === 'good' ? 'check' : 'alert'} size={18} color={c} stroke={2.2} />
      </span>
      <div style={{ flex: 1, minWidth: 0, fontFamily: BODY }}>
        {title && <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--color-text)' }}>{title}</div>}
        {children && <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: title ? 2 : 0, lineHeight: 1.45 }}>{children}</div>}
        {action}
      </div>
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voltar"
      style={{
        background: 'var(--color-surface-2)',
        border: 'none',
        width: 44,
        height: 44,
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        color: 'var(--color-text)',
        flexShrink: 0,
      }}
    >
      <Icon name="arrowL" size={20} />
    </button>
  )
}

export function Title({ children, size = 28, as = 'h1' }: { children: ReactNode; size?: number; as?: 'h1' | 'h2' }) {
  const Tag = as
  return (
    <Tag style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, letterSpacing: '-0.03em', color: 'var(--color-text)', lineHeight: 1.12, textWrap: 'pretty', margin: 0, whiteSpace: 'pre-line' }}>
      {children}
    </Tag>
  )
}

export function Sub({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p style={{ fontFamily: BODY, fontSize: 14.5, color: 'var(--color-text-sec)', marginTop: 10, marginBottom: 0, lineHeight: 1.5, textWrap: 'pretty', ...style }}>
      {children}
    </p>
  )
}

export function TextLink({ children, onClick, icon, center }: { children: ReactNode; onClick?: () => void; icon?: string; center?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '0 4px',
        background: 'none',
        border: 'none',
        color: 'var(--color-accent)',
        fontWeight: 700,
        fontSize: 13.5,
        cursor: 'pointer',
        fontFamily: BODY,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        alignSelf: center ? 'center' : 'auto',
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

/** Campo com erro/dica e ação à direita (ex.: Mostrar). */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
  inputMode,
  autoComplete,
  error,
  hint,
  action,
  locked,
  disabled,
  autoFocus,
  maxLength,
}: {
  label?: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  icon?: string
  type?: string
  inputMode?: 'text' | 'email' | 'numeric' | 'tel'
  autoComplete?: string
  error?: string | null
  hint?: string
  action?: ReactNode
  locked?: boolean
  disabled?: boolean
  autoFocus?: boolean
  maxLength?: number
}) {
  const [focused, setFocused] = useState(false)
  const border = error ? 'var(--color-warn)' : focused ? 'var(--color-accent)' : 'var(--color-border)'
  return (
    <label style={{ display: 'block', opacity: disabled ? 0.55 : 1 }}>
      {label && <div style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>{label}</div>}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: locked ? 'var(--color-surface-2)' : 'var(--color-surface-alt)',
          border: `1.5px solid ${border}`,
          borderRadius: 14,
          padding: '0 14px',
          minHeight: 50,
          transition: 'border-color .15s',
        }}
      >
        {icon && <Icon name={icon} size={18} color="var(--color-text-ter)" stroke={2} />}
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={!onChange || locked}
          placeholder={placeholder}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-invalid={!!error || undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            color: 'var(--color-text)',
            fontFamily: BODY,
            fontWeight: 500,
            minWidth: 0,
            padding: '13px 0',
          }}
        />
        {action}
        {locked && <Icon name="lock" size={16} color="var(--color-text-ter)" />}
      </div>
      {error && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontFamily: BODY, fontSize: 12.5, color: 'var(--color-warn)', marginTop: 7, lineHeight: 1.4, fontWeight: 600 }}>
          <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><Icon name="alert" size={14} stroke={2.2} /></span>
          {error}
        </div>
      )}
      {!error && hint && <div style={{ fontFamily: BODY, fontSize: 11.5, color: 'var(--color-text-ter)', marginTop: 6, lineHeight: 1.4 }}>{hint}</div>}
    </label>
  )
}

export function ShowToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={on ? 'Ocultar senha' : 'Mostrar senha'}
      style={{ minHeight: 44, padding: '0 2px', background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BODY }}
    >
      {on ? 'Ocultar' : 'Mostrar'}
    </button>
  )
}

/** Botão do handoff (`Btn`): primary · soft · ghost, tamanhos sm · md · lg. */
export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  full,
  icon,
  disabled,
  loading,
  type = 'button',
  style,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'soft' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  icon?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
}) {
  const [hover, setHover] = useState(false)
  const pads = { sm: '9px 14px', md: '13px 18px', lg: '16px 22px' }
  const fs = { sm: 13, md: 15, lg: 16 }
  const look =
    variant === 'primary'
      ? { background: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)', border: 'none' }
      : variant === 'ghost'
        ? { background: 'transparent', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' }
        : { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: 'none' }
  const off = disabled || loading
  return (
    <button
      type={type}
      onClick={off ? undefined : onClick}
      disabled={off}
      aria-busy={loading || undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: full ? '100%' : 'auto',
        minHeight: 44,
        padding: pads[size],
        fontSize: fs[size],
        fontWeight: 700,
        fontFamily: BODY,
        borderRadius: 16,
        cursor: off ? 'default' : 'pointer',
        opacity: disabled && !loading ? 0.45 : loading ? 0.8 : 1,
        whiteSpace: 'nowrap',
        transform: hover && !off ? 'translateY(-1px)' : 'none',
        transition: 'transform .15s, filter .15s',
        filter: hover && !off ? 'brightness(1.05)' : 'none',
        letterSpacing: '-0.01em',
        ...look,
        ...style,
      }}
    >
      {loading ? (
        <Spinner size={17} color={variant === 'primary' ? '#FBF3E4' : 'var(--color-accent)'} track={variant === 'primary' ? 'rgba(251,243,228,0.3)' : 'var(--color-gold-soft)'} />
      ) : (
        icon && <Icon name={icon} size={fs[size] + 3} stroke={2.2} />
      )}
      {children}
    </button>
  )
}

export function Card({ children, pad = 16, style }: { children: ReactNode; pad?: number; style?: CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 22, border: '1px solid var(--color-border-2)', boxShadow: 'var(--shadow-soft)', padding: pad, ...style }}>
      {children}
    </div>
  )
}

/** Rótulo de seção fora do card (Minha conta). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', textTransform: 'uppercase', margin: '0 4px 8px' }}>
      {children}
    </div>
  )
}

/** Linha rótulo ↔ valor (Minha conta, admin). */
export function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', fontFamily: BODY }}>
      <span style={{ fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 13.5, color: 'var(--color-text)', fontWeight: 700, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  )
}

/** Toast do handoff (RefToast): embaixo, espresso, check dourado — acima da tab bar do cliente. */
export function SocialToast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 20,
        right: 20,
        bottom: 'calc(76px + env(safe-area-inset-bottom))',
        zIndex: 9999,
        background: 'var(--color-espresso)',
        color: '#FAF5EC',
        borderRadius: 14,
        padding: '13px 16px',
        fontFamily: BODY,
        fontSize: 13.5,
        fontWeight: 600,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        boxShadow: 'var(--shadow-strong)',
        animation: 'saRise .25s ease',
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>
        <Icon name="check" size={17} color="var(--color-gold)" stroke={2.4} />
      </span>
      {message}
    </div>
  )
}

/** Toast que some sozinho. `message` novo reinicia o tempo. */
export function useSocialToast(ms = 2600) {
  const [message, setMessage] = useState<string | null>(null)
  const show = (m: string) => {
    setMessage(m)
    window.setTimeout(() => setMessage((cur) => (cur === m ? null : cur)), ms)
  }
  return { message, show }
}
