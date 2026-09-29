import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '../../brand/Icon'
import { RefPill, RF_BODY, RF_DISPLAY, type PillTone } from '../../client/referral/RefPrimitives'
import type { ReferralStateKey } from '../../../lib/referral'
import { useDragScroll } from '../../../hooks/useDragScroll'

/**
 * Kit das telas do admin do Indique e Ganhe — os auxiliares do handoff (`RAPill`, `RASignal`,
 * `RAChips`, `RALabel`, `RAInline`) e as primitivas do `brand.jsx` que as telas usam (`Switch`,
 * `Stepper`, `Btn`, `AppBar`, sheet). Tudo aqui é tela NOVA da indicação: segue o handoff por
 * inteiro (D-17), sem mexer nos componentes que as telas antigas do admin já usam.
 */

type IconName = Parameters<typeof Icon>[0]['name']

/** Estados vistos pelo ADMIN (§4.2) — rótulos próprios; em análise é dourado aqui (é com ele). */
export const RA_STATE: Record<ReferralStateKey, { label: string; tone: PillTone; icon: IconName }> = {
  analise: { label: 'Em análise', tone: 'gold', icon: 'search' },
  aguardando: { label: 'Aguardando', tone: 'neutral', icon: 'clock' },
  cadastro: { label: 'Cadastro', tone: 'neutral', icon: 'edit' },
  ganhou: { label: 'Recompensada', tone: 'good', icon: 'check' },
  recusada: { label: 'Recusada', tone: 'neutral', icon: 'x' },
  expirou: { label: 'Expirada', tone: 'neutral', icon: 'clock' },
}

/** Selo de estado: ícone + texto, nunca só cor. */
export function RaStatePill({ state }: { state: ReferralStateKey }) {
  const s = RA_STATE[state]
  return (
    <RefPill tone={s.tone}>
      <Icon name={s.icon} size={12} stroke={2.6} />
      {s.label}
    </RefPill>
  )
}

/** Sinal de análise (§4.4) — chip vermelho com alerta. Só o admin vê. */
export function RaSignal({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        background: 'var(--color-warn-soft)',
        color: 'var(--color-warn)',
        fontFamily: RF_BODY,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <Icon name="alert" size={11} stroke={2.6} />
      {children}
    </span>
  )
}

export interface RaChip<T extends string> {
  key: T
  label: string
  /** Contagem no chip (só aparece quando informada). */
  count?: number
}

/**
 * Chips de filtro com rolagem horizontal; o ativo fica espresso. No desktop a barra de rolagem
 * fica escondida, então o mouse arrasta (`useDragScroll`, o mesmo dos `FilterChips`) — sem isso
 * os chips do fim ("Expiradas", "Todas") ficavam fora de alcance.
 */
export function RaChips<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: RaChip<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  const { ref, handlers } = useDragScroll()
  return (
    <div
      ref={ref}
      {...handlers}
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 20px 2px', margin: '0 -20px', cursor: 'grab' }}
    >
      {items.map((it) => {
        const on = value === it.key
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.key)}
            style={{
              flexShrink: 0,
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 999,
              border: `1.5px solid ${on ? 'var(--color-espresso)' : 'var(--color-border)'}`,
              background: on ? 'var(--color-espresso)' : 'var(--color-surface)',
              color: on ? 'var(--color-primary-btn-text)' : 'var(--color-text)',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: RF_BODY,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {it.label}
            {it.count != null && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 99,
                  background: on ? 'var(--color-gold)' : 'var(--color-gold-soft)',
                  color: 'var(--color-espresso)',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Título de grupo em caixa alta, com dica opcional embaixo. */
export function RaLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ margin: '0 4px 8px' }}>
      <div
        style={{
          fontFamily: RF_BODY,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.1em',
          color: 'var(--color-text-ter)',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </div>
      {hint && <div style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-sec)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

/** Aviso em linha: erro (`danger`, role=alert), sucesso (`good`) ou atenção (`gold`). */
export function RaInline({ tone = 'danger', children }: { tone?: 'danger' | 'good' | 'gold'; children: ReactNode }) {
  const c = tone === 'danger' ? 'var(--color-warn)' : tone === 'good' ? 'var(--color-good)' : 'var(--color-accent)'
  const bg = tone === 'danger' ? 'var(--color-warn-soft)' : tone === 'good' ? 'var(--color-good-soft)' : 'var(--color-gold-soft)'
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 9,
        alignItems: 'flex-start',
        padding: '10px 12px',
        borderRadius: 12,
        background: bg,
        color: c,
        fontFamily: RF_BODY,
        fontSize: 12.5,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
        <Icon name={tone === 'good' ? 'check' : 'alert'} size={15} stroke={2.3} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

/** Interruptor do handoff (48 × 28, dourado ligado). */
export function RaSwitch({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: on ? 'var(--color-gold)' : 'var(--color-border)',
        padding: 3,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background .2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: on ? 'var(--color-espresso)' : 'var(--color-surface)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'all .2s',
        }}
      />
    </button>
  )
}

/**
 * Stepper de número inteiro. Botões de 44 px — o `Stepper` do protótipo tem 34, e o handoff pede
 * aumentar (alvo de toque, §14).
 */
export function RaStepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  label: string
}) {
  const btn = (dir: 1 | -1, name: IconName, enabled: boolean, aria: string) => (
    <button
      type="button"
      aria-label={aria}
      disabled={!enabled}
      onClick={() => enabled && onChange(value + dir)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 13,
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: enabled ? 'var(--color-text)' : 'var(--color-text-ter)',
        display: 'grid',
        placeItems: 'center',
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.5,
        flexShrink: 0,
      }}
    >
      <Icon name={name} size={16} stroke={2.4} />
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {btn(-1, 'minus', value > min, `Diminuir ${label}`)}
      <span
        aria-live="polite"
        aria-label={`${label}: ${value}`}
        style={{
          minWidth: 26,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: 18,
          fontFamily: RF_DISPLAY,
          color: value > 0 ? 'var(--color-accent)' : 'var(--color-text-ter)',
        }}
      >
        {value}
      </span>
      {btn(1, 'plus', value < max, `Aumentar ${label}`)}
    </div>
  )
}

type BtnVariant = 'primary' | 'gold' | 'ghost' | 'soft' | 'danger'

const BTN_PADS = { sm: '9px 14px', md: '13px 18px', lg: '16px 22px' } as const
const BTN_FS = { sm: 13, md: 15, lg: 16 } as const

/** Botão do handoff (`Btn`), mais a variante `danger` da recusa. */
export function RaBtn({
  children,
  onClick,
  variant = 'primary',
  full,
  size = 'md',
  icon,
  disabled,
  type = 'button',
  style,
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  full?: boolean
  size?: keyof typeof BTN_PADS
  icon?: IconName
  disabled?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
  ariaLabel?: string
}) {
  const skin: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)', border: 'none' },
    gold: { background: 'var(--color-gold)', color: 'var(--color-espresso)', border: 'none' },
    ghost: { background: 'transparent', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' },
    soft: { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: 'none' },
    danger: { background: 'var(--color-warn)', color: '#FFFFFF', border: 'none' },
  }
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: full ? '100%' : 'auto',
        minHeight: 44,
        padding: BTN_PADS[size],
        fontSize: BTN_FS[size],
        fontWeight: 700,
        fontFamily: RF_BODY,
        borderRadius: 16,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        ...skin[variant],
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={BTN_FS[size] + 3} stroke={2.2} />}
      {children}
    </button>
  )
}

/** Spinner do botão "Salvando…" (o `rfSpin` do handoff é o `cdp-spin` do app). */
export function RaSpinner({ color = 'var(--color-primary-btn-text)' }: { color?: string }) {
  return (
    <span
      className="cdp-spin"
      aria-hidden="true"
      style={{
        width: 16,
        height: 16,
        borderRadius: 99,
        border: '2.5px solid rgba(251,243,228,0.3)',
        borderTopColor: color,
        display: 'inline-block',
      }}
    />
  )
}

/** Barra do topo: voltar, título e um atalho opcional à direita. */
export function RaAppBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
      <button
        type="button"
        aria-label="Voltar"
        onClick={onBack}
        style={{
          background: 'var(--color-surface-2)',
          border: 'none',
          width: 38,
          height: 38,
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
      <h2
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontFamily: RF_DISPLAY,
          fontWeight: 700,
          fontSize: 21,
          letterSpacing: '-0.02em',
          color: 'var(--color-text)',
        }}
      >
        {title}
      </h2>
      {right}
    </div>
  )
}

/**
 * Sheet inferior do handoff (raio 26, fundo `app-bg`, alça). `role="dialog"` + `aria-modal`,
 * trap de foco, Esc fecha e o foco volta para quem abriu (§14).
 */
export function RaSheet({
  labelledBy,
  onClose,
  busy = false,
  children,
}: {
  labelledBy: string
  onClose: () => void
  /** Durante uma gravação o sheet não fecha (nem por Esc nem pelo fundo). */
  busy?: boolean
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Foco no próprio painel ao abrir (o conteúdo pode ainda estar carregando) e de volta para quem
  // abriu ao fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!busy) onClose()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusables = [
      ...sheetRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'),
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
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30,18,7,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 150,
      }}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        style={{
          outline: 'none',
          width: '100%',
          maxWidth: 480,
          maxHeight: '92dvh',
          overflowY: 'auto',
          background: 'var(--color-app-bg)',
          borderRadius: '26px 26px 0 0',
          padding: '10px 20px calc(22px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 9, background: 'var(--color-border)', margin: '0 auto 4px', flexShrink: 0 }} />
        {children}
      </div>
    </div>
  )
}

/** Título do sheet (Bricolage 20). */
export function RaSheetTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      style={{ margin: 0, flex: 1, fontFamily: RF_DISPLAY, fontWeight: 700, fontSize: 20, color: 'var(--color-text)', letterSpacing: '-0.02em' }}
    >
      {children}
    </h2>
  )
}

const BRT = 'America/Sao_Paulo'

/** "18/09" no fuso de Brasília. */
export function brtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: BRT })
}

/** "18/09 09:12" no fuso de Brasília — a linha do tempo do detalhe. */
export function brtDayTime(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: BRT })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: BRT })
  return `${day} ${time}`
}

/** Primeiro nome, para as frases de confirmação ("João ganha +5…"). */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}
