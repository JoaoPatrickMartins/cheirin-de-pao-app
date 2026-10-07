import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Icon, type Ic } from '../brand/Icon'

/**
 * Kit do app do entregador (handoff `screens-courier.jsx`, quadro "Kit do entregador").
 *
 * Regras do contexto (brief §2.1) que todo componente daqui respeita: ação principal ≥ 56 px na
 * metade de baixo da tela, estado SEMPRE com ícone + texto (nunca só cor) e nada de texto pequeno
 * no que importa. As cores vêm dos tokens de `globals.css` — nada de hex solto, exceto as sobreposições
 * escuras da câmera, que não têm token.
 */

type IconName = keyof typeof Ic

export const CR_DISPLAY = 'var(--font-display)'
export const CR_BODY = 'var(--font-body)'

/** "R$ 6,60" */
export const crMoney = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
/** 9.2 → "9,2" */
export const crNum = (n: number) => String(n).replace('.', ',')
/** Iniciais do nome ("Antônio Ribeiro" → "AR"). */
export const crInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()

/** Rótulo de seção em caixa-alta, com um item opcional à direita. */
export function CRLabel({ children, right, style }: { children: ReactNode; right?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 8px', ...style }}>
      <div
        style={{
          flex: 1,
          fontFamily: CR_BODY,
          fontSize: 11.5,
          fontWeight: 800,
          letterSpacing: '0.1em',
          color: 'var(--color-text-ter)',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </div>
      {right}
    </div>
  )
}

export type CRBigVariant = 'primary' | 'gold' | 'good' | 'danger' | 'dangerFill' | 'ghost' | 'soft' | 'light'

const BIG_VARIANTS: Record<CRBigVariant, { bg: string; color: string; icon: string; border: string }> = {
  primary: { bg: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)', icon: 'var(--color-gold)', border: 'none' },
  gold: { bg: 'var(--color-gold)', color: 'var(--color-espresso)', icon: 'var(--color-espresso)', border: 'none' },
  good: { bg: 'var(--color-good)', color: '#fff', icon: '#fff', border: 'none' },
  danger: { bg: 'transparent', color: 'var(--color-warn)', icon: 'var(--color-warn)', border: '2px solid var(--color-warn)' },
  dangerFill: { bg: 'var(--color-warn)', color: '#fff', icon: '#fff', border: 'none' },
  ghost: { bg: 'var(--color-surface)', color: 'var(--color-text)', icon: 'var(--color-text)', border: '1.5px solid var(--color-border)' },
  soft: { bg: 'var(--color-surface-2)', color: 'var(--color-text)', icon: 'var(--color-accent)', border: 'none' },
  // Sobre a câmera (fundo escuro).
  light: { bg: 'rgba(255,255,255,0.14)', color: '#fff', icon: '#fff', border: '1.5px solid rgba(255,255,255,0.22)' },
}

/** Botão grande (≥ 56 px) das ações principais, na área do polegar. */
export function CRBig({
  children,
  icon,
  variant = 'primary',
  onClick,
  disabled,
  h = 58,
  style,
  right,
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode
  icon?: IconName
  variant?: CRBigVariant
  onClick?: () => void
  disabled?: boolean
  h?: number
  style?: CSSProperties
  right?: ReactNode
  type?: 'button' | 'submit'
  ariaLabel?: string
}) {
  const v = BIG_VARIANTS[variant]
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        height: h,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: v.bg,
        color: v.color,
        border: v.border,
        borderRadius: 18,
        fontFamily: CR_BODY,
        fontWeight: 800,
        fontSize: 16.5,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        padding: '0 18px',
        flexShrink: 0,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={22} color={v.icon} stroke={2.3} aria-hidden="true" />}
      <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
      {right}
    </button>
  )
}

export type CRIconTone = 'ghost' | 'soft' | 'dark' | 'gold'

/** Botão quadrado só com ícone (44 px; > 50 px vira o grande). `label` é obrigatório (acessível). */
export function CRIconBtn({
  icon,
  onClick,
  size = 44,
  tone = 'ghost',
  label,
  badge,
}: {
  icon: IconName
  onClick?: () => void
  size?: number
  tone?: CRIconTone
  label: string
  badge?: ReactNode
}) {
  const s = {
    ghost: ['var(--color-surface)', 'var(--color-text)', '1.5px solid var(--color-border)'],
    soft: ['var(--color-surface-2)', 'var(--color-accent)', 'none'],
    dark: ['rgba(255,255,255,0.14)', '#fff', 'none'],
    gold: ['var(--color-gold-soft)', 'var(--color-accent)', 'none'],
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size > 50 ? 18 : 14,
        background: s[0],
        color: s[1],
        border: s[2],
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={size > 50 ? 24 : 20} stroke={2.1} aria-hidden="true" />
      {badge != null && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 99,
            background: 'var(--color-warn)',
            color: '#fff',
            fontSize: 10.5,
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            padding: '0 5px',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

/** Spinner dos estados "Enviando…/Conferindo…". */
export function CRSpin({ size = 18, color = 'var(--color-accent)' }: { size?: number; color?: string }) {
  return (
    <span
      className="cdp-spin"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        border: `2.5px solid ${color}`,
        borderTopColor: 'transparent',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

/** Esqueleto de carregamento. */
export function CRSkel({ h = 16, w = '100%', r = 12, style }: { h?: number; w?: number | string; r?: number; style?: CSSProperties }) {
  return <div className="cdp-shimmer" aria-hidden="true" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

export type CRTagTone = 'neutral' | 'gold' | 'good' | 'danger' | 'dark' | 'warn'

const TAG_TONES: Record<CRTagTone, [string, string]> = {
  neutral: ['var(--color-surface-2)', 'var(--color-text-sec)'],
  gold: ['var(--color-gold-soft)', 'var(--color-amber-ink)'],
  good: ['var(--color-good-soft)', 'var(--color-good)'],
  danger: ['var(--color-warn-soft)', 'var(--color-warn)'],
  dark: ['var(--color-espresso)', 'var(--color-gold)'],
  warn: ['var(--color-amber-soft)', 'var(--color-amber-ink)'],
}

/** Selo de estado — sempre ícone (ou emoji) + texto. */
export function CRTag({
  icon,
  children,
  tone = 'neutral',
  size = 'md',
  emoji,
}: {
  icon?: IconName
  children: ReactNode
  tone?: CRTagTone
  size?: 'sm' | 'md'
  emoji?: string
}) {
  const [bg, fg] = TAG_TONES[tone]
  const sm = size === 'sm'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: sm ? '2px 7px' : '3px 9px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontFamily: CR_BODY,
        fontSize: sm ? 11 : 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        lineHeight: 1.35,
      }}
    >
      {emoji ? (
        <span aria-hidden="true">{emoji}</span>
      ) : (
        icon && <Icon name={icon} size={sm ? 11 : 12.5} stroke={2.6} aria-hidden="true" />
      )}
      {children}
    </span>
  )
}

/** Estado do comprovante na tela. `pendente`/`falhou` existem só no aparelho (fila offline). */
export type CRProofState = 'ok' | 'enviando' | 'pendente' | 'falhou' | 'sem' | 'pulada'

const PROOF_META: Record<CRProofState, [IconName, string, CRTagTone]> = {
  ok: ['camera', 'foto ok', 'good'],
  enviando: ['cloudUp', 'enviando', 'neutral'],
  pendente: ['cloudOff', 'pendente de envio', 'warn'],
  falhou: ['refresh', 'tentando de novo', 'warn'],
  sem: ['ban', 'sem foto', 'danger'],
  pulada: ['ban', 'sem foto · pulada', 'neutral'],
}

export function CRProof({ state, size = 'sm' }: { state: CRProofState | null | undefined; size?: 'sm' | 'md' }) {
  if (!state) return null
  const [icon, label, tone] = PROOF_META[state]
  return (
    <CRTag icon={icon} tone={tone} size={size}>
      {label}
    </CRTag>
  )
}

/** Chips dos itens da Cestinha ("1× Café 250 g"). */
export function CRCesta({ items }: { items?: Array<{ name: string; qty: number }> | null }) {
  if (!items || items.length === 0) return null
  return (
    <>
      {items.map((x, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'var(--color-gold-soft)',
            color: 'var(--color-amber-ink)',
            fontFamily: CR_BODY,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          <Icon name="basket" size={11} stroke={2.4} aria-hidden="true" />
          {x.qty}× {x.name}
        </span>
      ))}
    </>
  )
}

/** Foto do entregador ou iniciais sobre espresso. */
export function CRAvatar({ name, photoUrl, size = 44, radius }: { name: string; photoUrl?: string | null; size?: number; radius?: number }) {
  const r = radius ?? size
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Foto de ${name}`}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flexShrink: 0, border: '2px solid var(--color-gold)' }}
      />
    )
  }
  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: 'var(--color-espresso)',
        color: 'var(--color-gold)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: CR_DISPLAY,
        fontWeight: 800,
        fontSize: size * 0.38,
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {crInitials(name)}
    </div>
  )
}

/**
 * Sheet de baixo. `role="dialog"` + `aria-modal`, trap de foco, Esc fecha e o foco volta para quem
 * abriu (mesmo padrão do `RaSheet`). `busy` impede fechar durante um envio. `dark` = sobre a câmera.
 */
export function CRSheet({
  children,
  title,
  sub,
  onClose,
  busy = false,
  dark = false,
  pad = 20,
}: {
  children: ReactNode
  title?: ReactNode
  sub?: ReactNode
  onClose?: () => void
  busy?: boolean
  dark?: boolean
  pad?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  const close = () => {
    if (!busy) onClose?.()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusables = [
      ...panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'),
    ].filter((el) => !(el as HTMLButtonElement).disabled)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        background: 'rgba(20,12,4,0.55)',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          outline: 'none',
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          maxHeight: '92dvh',
          overflowY: 'auto',
          background: dark ? 'var(--color-espresso)' : 'var(--color-surface)',
          color: dark ? 'var(--color-app-bg)' : 'var(--color-text)',
          borderRadius: '28px 28px 0 0',
          padding: `10px ${pad}px calc(26px + env(safe-area-inset-bottom, 0px))`,
          boxShadow: '0 -10px 40px -10px rgba(0,0,0,0.35)',
          fontFamily: CR_BODY,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 5,
            borderRadius: 99,
            background: dark ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
            margin: '0 auto 16px',
          }}
        />
        {(title || onClose) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              {title && (
                <h2
                  id={titleId}
                  style={{ margin: 0, fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', lineHeight: 1.15 }}
                >
                  {title}
                </h2>
              )}
              {sub && (
                <div style={{ fontSize: 14, color: dark ? 'var(--color-text-ter)' : 'var(--color-text-sec)', marginTop: 5, lineHeight: 1.4 }}>
                  {sub}
                </div>
              )}
            </div>
            {onClose && <CRIconBtn icon="x" onClick={close} tone={dark ? 'dark' : 'soft'} label="Fechar" />}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Toast escuro (rodapé ou topo). Anunciado por leitor de tela. */
export function CRToast({ children, icon = 'check', tone = 'good', top }: { children: ReactNode; icon?: IconName; tone?: 'good' | 'gold'; top?: boolean }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        [top ? 'top' : 'bottom']: top ? 'calc(60px + env(safe-area-inset-top, 0px))' : 110,
        zIndex: 160,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--color-text)',
        color: 'var(--color-app-bg)',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-strong)',
        fontFamily: CR_BODY,
        fontWeight: 700,
        fontSize: 14.5,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 99,
          background: tone === 'good' ? 'var(--color-good)' : 'var(--color-gold)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={16} color={tone === 'good' ? '#fff' : 'var(--color-espresso)'} stroke={2.8} aria-hidden="true" />
      </span>
      {children}
    </div>
  )
}

export type CRNoteTone = 'neutral' | 'gold' | 'danger' | 'good'

const NOTE_TONES: Record<CRNoteTone, [string, string, string]> = {
  neutral: ['var(--color-surface-2)', 'var(--color-text-sec)', 'var(--color-accent)'],
  gold: ['var(--color-note-gold)', 'var(--color-note-gold-ink)', 'var(--color-accent)'],
  danger: ['var(--color-warn-soft)', 'var(--color-warn)', 'var(--color-warn)'],
  good: ['var(--color-good-soft)', 'var(--color-good)', 'var(--color-good)'],
}

/** Aviso inline (ícone + texto). */
export function CRNote({ icon = 'alert', tone = 'neutral', children, style }: { icon?: IconName; tone?: CRNoteTone; children: ReactNode; style?: CSSProperties }) {
  const [bg, fg, ic] = NOTE_TONES[tone]
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        background: bg,
        color: fg,
        borderRadius: 14,
        padding: '11px 13px',
        fontFamily: CR_BODY,
        fontSize: 13,
        lineHeight: 1.45,
        fontWeight: 600,
        ...style,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>
        <Icon name={icon} size={17} color={ic} stroke={2.2} aria-hidden="true" />
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

/**
 * Faixa de sincronização da fila offline: "Sem sinal — N entregas guardadas" ou "Enviando N…".
 * Sinal fraco é normal no prédio, não é erro — por isso âmbar, nunca vermelho.
 */
export function CRSync({ kind, count }: { kind: 'offline' | 'sending'; count: number }) {
  const offline = kind === 'offline'
  const entregas = count === 1 ? '1 entrega guardada, sobe' : `${count} entregas guardadas, sobem`
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: offline ? 'var(--color-amber-soft)' : 'var(--color-surface-2)',
        color: offline ? 'var(--color-amber-text)' : 'var(--color-text-sec)',
        borderRadius: 16,
        padding: '11px 14px',
        border: offline ? '1px solid var(--color-amber-line)' : 'none',
        fontFamily: CR_BODY,
      }}
    >
      {offline ? <Icon name="cloudOff" size={20} color="var(--color-amber-ink)" stroke={2.2} aria-hidden="true" /> : <CRSpin size={17} />}
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>
        {offline ? (
          <>
            <b>Sem sinal</b> — {entregas} quando o sinal voltar
          </>
        ) : (
          `Enviando ${count}…`
        )}
      </span>
      {!offline && <Icon name="cloudUp" size={18} color="var(--color-accent)" aria-hidden="true" />}
    </div>
  )
}

/** Opção de escolha única (motivos, app de mapas, ponto de partida). Acessível como `radio`. */
export function CRChoice({
  icon,
  children,
  on,
  onClick,
  disabled,
  note,
}: {
  icon?: IconName
  children: ReactNode
  on?: boolean
  onClick?: () => void
  disabled?: boolean
  note?: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!on}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 54,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        borderRadius: 16,
        border: `2px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`,
        background: on ? 'var(--color-surface-2)' : 'var(--color-surface)',
        color: 'var(--color-text)',
        fontFamily: CR_BODY,
        fontSize: 15.5,
        fontWeight: 700,
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon && <Icon name={icon} size={19} color={on ? 'var(--color-text)' : 'var(--color-accent)'} stroke={2.1} aria-hidden="true" />}
      <span style={{ flex: 1, padding: '10px 0' }}>
        {children}
        {note && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>{note}</span>}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: 99,
          border: `2.5px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {on && <span style={{ width: 11, height: 11, borderRadius: 99, background: 'var(--color-text)' }} />}
      </span>
    </button>
  )
}

/** Área de texto com erro de campo ("Escreva o motivo para seguir"). */
export function CRTextarea({
  value,
  onChange,
  placeholder = 'Conte o que aconteceu',
  error,
  label,
  maxLength = 500,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string | null
  label?: string
  maxLength?: number
  style?: CSSProperties
}) {
  const errId = useId()
  return (
    <div style={style}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        maxLength={maxLength}
        rows={3}
        style={{
          width: '100%',
          minHeight: 84,
          borderRadius: 14,
          border: `1.5px solid ${error ? 'var(--color-warn)' : 'var(--color-border)'}`,
          background: 'var(--color-surface-alt)',
          padding: '12px 14px',
          fontFamily: CR_BODY,
          fontSize: 15,
          color: 'var(--color-text)',
          lineHeight: 1.45,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <div
          id={errId}
          style={{ fontSize: 12.5, color: 'var(--color-warn)', fontWeight: 700, marginTop: 6, display: 'flex', gap: 5, alignItems: 'center', fontFamily: CR_BODY }}
        >
          <Icon name="alert" size={13} stroke={2.4} aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  )
}
