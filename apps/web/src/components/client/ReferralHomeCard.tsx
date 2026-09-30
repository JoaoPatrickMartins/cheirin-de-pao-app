import { useNavigate } from 'react-router'
import { Icon } from '../brand/Icon'
import { apiFetch } from '../../lib/apiFetch'
import { shortDay } from '../../lib/referral'
import { patchReferralSummary, useReferralSummary } from '../../hooks/useReferralSummary'

/**
 * C3 — card do Indique e Ganhe na Home, entre as ações rápidas e o Além do Pãozin.
 * Handoff: `RefHomeCard` (screens-referral2.jsx).
 *
 * Quem decide se aparece é o servidor (`summary.homeCard.visible`: programa ligado + ≥ 1 entrega
 * recebida + não fechado nos últimos 30 dias). Fechar grava no servidor (D-11), e o card some na
 * hora pelo cache do resumo — sem esperar a resposta.
 */
export function ReferralHomeCard() {
  const navigate = useNavigate()
  const { summary } = useReferralSummary()
  if (!summary?.homeCard.visible) return null

  const campaign = summary.campaign
  const dismiss = () => {
    patchReferralSummary((s) => ({ ...s, homeCard: { visible: false } }))
    void apiFetch('/referrals/home-card/dismiss', { method: 'POST' }).catch(() => {})
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: 13,
        alignItems: 'center',
        padding: 14,
        borderRadius: 22,
        background: campaign ? 'var(--color-gold-soft)' : 'var(--color-surface)',
        border: `1px solid ${campaign ? 'rgba(176,112,42,0.25)' : 'var(--color-border-2)'}`,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: campaign ? 'var(--color-gold)' : 'var(--color-gold-soft)',
          color: campaign ? 'var(--color-espresso)' : 'var(--color-accent)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="gift" size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 22, fontFamily: 'var(--font-body)' }}>
        {campaign && (
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--color-accent)', marginBottom: 3, textTransform: 'uppercase' }}>
            {campaign.label} · até {shortDay(campaign.until)}
          </div>
        )}
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)', lineHeight: 1.3 }}>
          Indique um vizinho, ganhe {summary.rewardBreads} {summary.rewardBreads === 1 ? 'pãozin' : 'pãezins'}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.4 }}>
          Quando o pão chegar na porta dele.
        </div>
        <button
          type="button"
          onClick={() => navigate('/client/perfil/indique')}
          style={{
            marginTop: 9,
            minHeight: 36,
            padding: '0 14px',
            borderRadius: 11,
            border: 'none',
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Indicar agora
          <Icon name="chevR" size={14} stroke={2.4} />
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar por 30 dias"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 44,
          height: 44,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-ter)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name="x" size={17} stroke={2.2} />
      </button>
    </div>
  )
}
