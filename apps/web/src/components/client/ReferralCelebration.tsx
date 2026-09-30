import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Icon } from '../brand/Icon'
import { BreadMark } from '../brand/BreadMark'
import type { ReferralCelebration as Celebration } from '../../lib/referral'

/**
 * C5 — comemoração na abertura do app (sheet inferior). Handoff: `RefCelebration`
 * (screens-referral3.jsx). Quatro variantes, na prioridade que o servidor já aplicou:
 * `friend` → `goal` → `multi` → `referrer`.
 *
 * Textos do handoff, com uma troca: "A Maria recebeu…" vira "Maria recebeu…" e "indicação do
 * João", "indicação de João" — o sistema não sabe o gênero das pessoas (V-13 do plano).
 */

const NUMBER_WORDS = [
  '', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez',
  'Onze', 'Doze', 'Treze', 'Quatorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove', 'Vinte',
]

/** "Maria, Pedro e Lúcia". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

const fmt = (n: number) => String(n).replace('.', ',')
const breadsWord = (n: number) => (n === 1 ? 'pãozin' : 'pãezins')

interface Copy {
  eyebrow: string
  title: string
  body: string
  cta: string
  to: string
  icon: 'gift' | 'wallet'
  initials?: string[]
}

function copyFor(c: Celebration): Copy {
  const n = fmt(c.breads)
  switch (c.variant) {
    case 'friend':
      return {
        eyebrow: 'PRESENTE DE BOAS-VINDAS',
        title: 'Chegou presente pra você',
        body: `${n} ${breadsWord(c.breads)} por ter vindo pela indicação${c.referrerName ? ` de ${c.referrerName}` : ''}. Já estão no seu saldo.`,
        cta: 'Ver meu saldo',
        to: '/client/creditos/extrato',
        icon: 'wallet',
      }
    case 'goal': {
      const g = c.goal
      const threshold = g?.threshold ?? 0
      const who =
        threshold === 1 ? 'Um vizinho' : `${NUMBER_WORDS[threshold] ?? threshold} vizinhos`
      const next = g?.next ? ` Próxima meta: ${g.next.threshold}ª indicação, +${fmt(g.next.bonus)}.` : ''
      return {
        eyebrow: 'META ATINGIDA',
        title: `+${n} ${breadsWord(c.breads)} pela ${threshold}ª indicação`,
        body: `${who} com pão fresquinho na porta.${next}`,
        cta: 'Indicar mais',
        to: '/client/perfil/indique',
        icon: 'gift',
      }
    }
    case 'multi':
      return {
        eyebrow: 'ENQUANTO VOCÊ ESTAVA FORA',
        title: `Você ganhou ${n} ${breadsWord(c.breads)} com ${c.seen.referralIds.length} indicações`,
        body: `${joinNames(c.names)} ${c.names.length === 1 ? 'recebeu' : 'receberam'} o primeiro pedido.`,
        cta: 'Indicar mais',
        to: '/client/perfil/indique',
        icon: 'gift',
        initials: c.names.slice(0, 3).map((name) => name.charAt(0).toUpperCase()),
      }
    case 'referrer':
    default:
      return {
        eyebrow: 'INDICAÇÃO QUE VALEU',
        title: `Você ganhou ${n} ${breadsWord(c.breads)}!`,
        body: `${c.names[0] ?? 'Sua indicação'} recebeu o primeiro pedido. Obrigado por espalhar o cheirinho de pão.`,
        cta: 'Indicar mais',
        to: '/client/perfil/indique',
        icon: 'gift',
      }
  }
}

export function ReferralCelebration({
  celebration,
  onClose,
  onGo,
}: {
  celebration: Celebration
  /** "Agora não", o X ou Esc. */
  onClose: () => void
  /** O CTA: fecha e navega. */
  onGo: (to: string) => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const c = copyFor(celebration)

  // Foco: vai para o CTA ao abrir e volta para onde estava ao fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ctaRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  // Trap de foco (Tab/Shift+Tab dão a volta dentro do sheet) + Esc fecha.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusables = sheetRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
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
      aria-labelledby="ref-cel-title"
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(30,18,7,0.62)',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 14,
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        ref={sheetRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--color-surface)',
          borderRadius: 28,
          padding: '28px 22px 20px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-strong)',
          overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 170,
            background: 'radial-gradient(120% 90% at 50% 0%, var(--color-gold-soft) 0%, rgba(243,221,166,0) 70%)',
          }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'none',
            border: 'none',
            color: 'var(--color-text-sec)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon name="x" size={19} stroke={2.2} />
        </button>
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            margin: '0 auto',
            borderRadius: 999,
            background: 'var(--color-espresso)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 0 8px var(--color-gold-soft)',
          }}
        >
          <BreadMark size={66} color="var(--color-gold)" side={0.8} />
          {c.initials && (
            <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>
              {c.initials.map((ch, i) => (
                <span
                  key={`${ch}${i}`}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 99,
                    background: 'var(--color-gold)',
                    color: 'var(--color-espresso)',
                    border: '2px solid var(--color-surface)',
                    marginLeft: i ? -7 : 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 11.5,
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: 'var(--color-accent)', marginTop: 22 }}>
          {c.eyebrow}
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, letterSpacing: '-0.04em', color: 'var(--color-text)', lineHeight: 1 }}>
            +{fmt(celebration.breads)}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--color-accent)' }}>
            {breadsWord(celebration.breads)}
          </span>
        </div>
        <h2
          id="ref-cel-title"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '10px 0 0', lineHeight: 1.2 }}
        >
          {c.title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-sec)', margin: '8px 0 0', lineHeight: 1.5, textWrap: 'pretty' }}>{c.body}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          <button
            ref={ctaRef}
            type="button"
            onClick={() => onGo(c.to)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '16px 22px',
              borderRadius: 16,
              border: 'none',
              background: 'var(--color-espresso)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon name={c.icon} size={19} stroke={2.2} />
            {c.cta}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 44,
              background: 'none',
              border: 'none',
              color: 'var(--color-text-sec)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
