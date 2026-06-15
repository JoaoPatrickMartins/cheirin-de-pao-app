/**
 * BannerCobertura — 2 estados de cobertura de créditos
 *
 * Estado A (falta: semana > saldo): fundo goldSoft, borda gold, ícone alert → onCombos
 * Estado B (cobre: semana <= saldo): fundo surface, borda border2, ícone repeat → onAutoBuy
 * Oculto quando semana === 0 (sem consumo para calcular)
 *
 * Requirements: SCHED-05 (alerta de cobertura), SCHED-06 (cálculo D-03)
 * Source: screens-order.jsx linhas 230–242, 04-UI-SPEC.md seção 5
 */
import { Icon } from '../brand/Icon'

interface BannerCoberturaProps {
  semana: number
  saldo: number
  cobre: number
  onCombos: () => void
  onAutoBuy: () => void
}

export default function BannerCobertura({
  semana,
  saldo,
  cobre,
  onCombos,
  onAutoBuy,
}: BannerCoberturaProps) {
  // Ocultar quando consumo é zero — não há nada para calcular
  if (semana === 0) return null

  const falta = semana > saldo

  if (falta) {
    // Estado A — saldo insuficiente
    return (
      <div
        onClick={onCombos}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCombos() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '14px 16px',
          background: 'var(--color-gold-soft)',
          border: '1.5px solid var(--color-gold)',
          borderRadius: 16,
          marginTop: 14,
          cursor: 'pointer',
        }}
      >
        <Icon name="alert" size={20} color="var(--color-accent)" />
        <p
          style={{
            flex: 1,
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          Seu saldo ({saldo}) não cobre a semana ({semana}).{' '}
          <strong>Compre um combo</strong> ou ative a reposição automática.
        </p>
        <Icon name="chevR" size={18} color="var(--color-accent)" />
      </div>
    )
  }

  // Estado B — saldo suficiente
  return (
    <div
      onClick={onAutoBuy}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAutoBuy() }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '14px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        marginTop: 14,
        cursor: 'pointer',
      }}
    >
      <Icon name="repeat" size={19} color="var(--color-accent)" />
      <p
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-sec)',
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        Saldo cobre <strong>~{cobre} semanas</strong>. Ative a compra automática pra nunca faltar.
      </p>
      <Icon name="chevR" size={18} color="var(--color-text-ter)" />
    </div>
  )
}
