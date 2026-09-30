import { useEffect, useRef, useState } from 'react'
import { splitReferralCode } from '@cheirin-de-pao/shared'
import { Icon } from '../../brand/Icon'
import { copyText } from '../../../lib/referral'
import { RF_BODY, RF_DISPLAY } from './RefPrimitives'

/**
 * Código grande em 2 grupos, para ler e ditar ("JOAO · 7K2F"), com o sufixo em dourado.
 * O `aria-label` soletra: um leitor de tela leria "JOAO7K2F" como uma palavra. `role="img"` é o
 * que garante que o rótulo seja lido — num `span` sem papel, vários leitores o ignoram.
 */
export function RefCode({ code, size = 34, color = 'var(--color-text)' }: { code: string; size?: number; color?: string }) {
  const { prefix, suffix } = splitReferralCode(code)
  return (
    <span
      role="img"
      aria-label={`Código ${code.split('').join(' ')}`}
      style={{
        fontFamily: RF_DISPLAY,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '0.06em',
        color,
        display: 'inline-flex',
        gap: size * 0.3,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <span aria-hidden="true" style={{ color: 'var(--color-gold)' }}>
        {suffix}
      </span>
    </span>
  )
}

/** Quanto tempo o "Copiado!" fica na tela. */
export const COPIED_MS = 1800

/** Cartão-tíquete do código, com o botão Copiar (que vira "Copiado!" em verde por 1,8 s). */
export function RefCodeCard({ code, onDark = false }: { code: string; onDark?: boolean }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    if (!(await copyText(code))) return
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1.5px dashed ${onDark ? 'rgba(227,172,63,0.55)' : 'var(--color-gold)'}`,
        background: onDark ? 'rgba(250,245,236,0.06)' : 'var(--color-surface)',
        padding: '14px 14px 14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: RF_BODY,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: onDark ? 'rgba(250,245,236,0.6)' : 'var(--color-text-ter)',
            marginBottom: 8,
          }}
        >
          SEU CÓDIGO
        </div>
        <RefCode code={code} size={30} color={onDark ? 'var(--color-app-bg)' : 'var(--color-text)'} />
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-live="polite"
        style={{
          minWidth: 96,
          height: 46,
          borderRadius: 14,
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          fontWeight: 800,
          fontSize: 13.5,
          fontFamily: RF_BODY,
          background: copied ? 'var(--color-good)' : 'var(--color-gold)',
          color: copied ? '#fff' : 'var(--color-espresso)',
          transition: 'background .2s',
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} size={17} stroke={2.3} />
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}
