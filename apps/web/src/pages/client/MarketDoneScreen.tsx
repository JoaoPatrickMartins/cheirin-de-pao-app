import { useLocation, useNavigate } from 'react-router'
import { Icon } from '../../components/brand/Icon'
import { formatBRL } from '../../lib/market'

interface DoneState {
  creditsApplied?: number
  moneyAmount?: number
  totalValue?: number
  scheduledDate?: string
  deliveryTime?: string | null
  breadQty?: number
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function whenText(dateStr?: string, deliveryTime?: string | null): string {
  if (!dateStr) return 'na próxima entrega'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const hoje = new Date()
  const isTomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1).toDateString() === dt.toDateString()
  const isToday = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toDateString() === dt.toDateString()
  const dia = isToday ? 'hoje' : isTomorrow ? 'amanhã' : `${d} de ${MONTHS[m - 1]}`
  return `${dia}${deliveryTime ? `, na entrega das ${deliveryTime}` : ''}`
}

/**
 * MarketDoneScreen — sucesso do checkout da Cestinha. Mostra o que foi pago (pãezinhos +
 * dinheiro) e quando chega (junto com o pão). "Acompanhar" leva ao histórico de pedidos
 * (integração do market no acompanhamento vem na Onda 6).
 */
export function MarketDoneScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const s = (location.state as DoneState | null) ?? {}

  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'calc(24px + env(safe-area-inset-top)) 24px 32px', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-good-soft)', display: 'grid', placeItems: 'center' }}>
        <Icon name="check" size={38} color="var(--color-good)" stroke={2.6} />
      </div>

      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
          Pedido confirmado!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, color: 'var(--color-text-sec)', margin: '8px 0 0', lineHeight: 1.5, maxWidth: 300 }}>
          Sua Cestinha chega <strong style={{ color: 'var(--color-text)' }}>{whenText(s.scheduledDate, s.deliveryTime)}</strong> — junto com o seu pão. 🥖
        </p>
      </div>

      {/* Resumo do pagamento */}
      <div style={{ width: '100%', maxWidth: 340, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {(s.creditsApplied ?? 0) > 0 && (
          <Row label="Pago com pãezinhos" value={`${s.creditsApplied} 🥖`} accent />
        )}
        {(s.moneyAmount ?? 0) > 0 && (
          <Row label="Pago em dinheiro" value={formatBRL(s.moneyAmount ?? 0)} />
        )}
        {s.totalValue != null && (
          <>
            <div style={{ height: 1, background: 'var(--color-border-2)' }} />
            <Row label="Total" value={formatBRL(s.totalValue)} bold />
          </>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => navigate('/client/pedidos')}
          style={{ width: '100%', minHeight: 52, borderRadius: 'var(--radius-btn)', border: 'none', background: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
        >
          Acompanhar pedidos
        </button>
        <button
          onClick={() => navigate('/client/home')}
          style={{ width: '100%', minHeight: 48, borderRadius: 'var(--radius-btn)', border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)' }}>{label}</span>
      <span
        style={{
          fontFamily: bold ? 'var(--font-display)' : 'var(--font-body)',
          fontSize: bold ? 17 : 14,
          fontWeight: bold ? 800 : 700,
          color: accent ? 'var(--color-accent)' : 'var(--color-text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
