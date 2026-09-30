import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../brand/Icon'
import type { ReferralStateKey } from '../../../lib/referral'

/**
 * Primitivos das telas do Indique e Ganhe — o `Card`, o `Pill` e o título de seção do handoff
 * (brand.jsx), com os tokens do app. Ficam aqui, e não num kit global, porque as telas antigas
 * têm cada uma o próprio card inline e o D-17 proíbe redesenhá-las por tabela.
 */

export const RF_DISPLAY = 'var(--font-display)'
export const RF_BODY = 'var(--font-body)'

export function RefCard({ children, pad = 16, style }: { children: ReactNode; pad?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 22,
        border: '1px solid var(--color-border-2)',
        boxShadow: 'var(--shadow-soft)',
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export type PillTone = 'neutral' | 'gold' | 'good'

const PILL_TONES: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-surface-2)', fg: 'var(--color-text-sec)' },
  gold: { bg: 'var(--color-gold-soft)', fg: 'var(--color-accent)' },
  good: { bg: 'var(--color-good-soft)', fg: 'var(--color-good)' },
}

export function RefPill({ tone = 'neutral', children, style }: { tone?: PillTone; children: ReactNode; style?: CSSProperties }) {
  const t = PILL_TONES[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontFamily: RF_BODY,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** Título de seção em caixa alta ("SEU RESUMO"), com um item opcional à direita. */
export function RefSection({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 4px 9px' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: RF_BODY,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--color-text-ter)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Bloco de carregamento — o `rfShimmer` do handoff é o `cdp-shimmer` do app. */
export function RefSkel({ h = 16, w = '100%', r = 10, style }: { h?: number; w?: number | string; r?: number; style?: CSSProperties }) {
  return <div className="cdp-shimmer" aria-hidden="true" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

/** Estados vistos por QUEM INDICOU (§4.2). Todo selo leva ícone + texto, nunca só cor. */
export const REF_STATE: Record<ReferralStateKey, { label: string; tone: PillTone; icon: 'edit' | 'clock' | 'search' | 'check' | 'x' }> = {
  cadastro: { label: 'Cadastro em andamento', tone: 'neutral', icon: 'edit' },
  aguardando: { label: 'Aguardando 1º pedido', tone: 'gold', icon: 'clock' },
  analise: { label: 'Em análise', tone: 'neutral', icon: 'search' },
  ganhou: { label: 'Ganhou', tone: 'good', icon: 'check' },
  recusada: { label: 'Não valeu', tone: 'neutral', icon: 'x' },
  expirou: { label: 'Prazo encerrado', tone: 'neutral', icon: 'clock' },
}

export function RefStatePill({ state, reward }: { state: ReferralStateKey; reward?: number | null }) {
  const s = REF_STATE[state]
  const muted = state === 'recusada' || state === 'expirou'
  return (
    <RefPill tone={s.tone} style={muted ? { opacity: 0.8 } : undefined}>
      <Icon name={s.icon} size={12} stroke={2.6} />
      {state === 'ganhou' && reward != null ? `Ganhou +${String(reward).replace('.', ',')}` : s.label}
    </RefPill>
  )
}
