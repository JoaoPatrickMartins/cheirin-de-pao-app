import { useRef } from 'react'

interface OtpInputProps {
  value: string[]
  onChange: (value: string[]) => void
  onComplete: (code: string) => void
}

/**
 * 4-input OTP component with auto-focus, backspace navigation, and onComplete callback.
 * Each box: 64×72px, radius 18px, --color-surface-alt bg
 * Filled border: 1.5px --color-accent; empty border: 1.5px --color-border
 * Font: 30px --font-display weight 700
 */
export function OtpInput({ value, onChange, onComplete }: OtpInputProps) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = [...value]
    next[i] = v
    onChange(next)
    if (v && i < 3) {
      refs[i + 1].current?.focus()
    }
    if (v && i === 3 && next.every((d) => d.length === 1)) {
      onComplete(next.join(''))
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && value[i] === '' && i > 0) {
      refs[i - 1].current?.focus()
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={refs[i]}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          maxLength={1}
          inputMode="numeric"
          autoComplete="one-time-code"
          style={{
            width: 64,
            height: 72,
            textAlign: 'center',
            fontSize: 30,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
            background: 'var(--color-surface-alt)',
            border: `1.5px solid ${digit ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 18,
            outline: 'none',
          }}
        />
      ))}
    </div>
  )
}
