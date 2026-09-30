import type { ReferralMe } from '../../../lib/referral'
import { RF_BODY, RF_DISPLAY, RefStatePill } from './RefPrimitives'

type Item = ReferralMe['referrals'][number]

/** "12/09" — a data curta da lista. */
function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

/** Item da lista de indicados: inicial, nome curto, selo + data, "+X" (e "em dobro"). */
export function RefItem({ item, last }: { item: Item; last: boolean }) {
  const off = item.state === 'recusada' || item.state === 'expirou'
  const won = item.state === 'ganhou'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--color-border-2)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: won ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
          color: won ? 'var(--color-accent)' : 'var(--color-text-sec)',
          display: 'grid',
          placeItems: 'center',
          fontFamily: RF_DISPLAY,
          fontWeight: 800,
          fontSize: 15,
          flexShrink: 0,
          opacity: off ? 0.7 : 1,
        }}
      >
        {item.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: RF_BODY, fontWeight: 700, fontSize: 14.5, color: off ? 'var(--color-text-sec)' : 'var(--color-text)' }}>
          {item.name}
        </div>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RefStatePill state={item.state} reward={item.rewardBreads} />
          <span style={{ fontFamily: RF_BODY, fontSize: 11.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>
            {shortDate(item.date)}
          </span>
        </div>
      </div>
      {won && item.rewardBreads != null && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: RF_DISPLAY, fontWeight: 800, fontSize: 19, color: 'var(--color-good)', letterSpacing: '-0.02em' }}>
            +{String(item.rewardBreads).replace('.', ',')}
          </div>
          {item.campaign && (
            <div style={{ fontFamily: RF_BODY, fontSize: 10.5, color: 'var(--color-accent)', fontWeight: 700 }}>em dobro</div>
          )}
        </div>
      )}
    </div>
  )
}
