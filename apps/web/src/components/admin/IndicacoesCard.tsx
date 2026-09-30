import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import type { ReferralStateKey } from '../../lib/referral'
import { Icon } from '../brand/Icon'
import { RefCard, RF_BODY, RF_DISPLAY } from '../client/referral/RefPrimitives'
import { RaStatePill, brtDay } from './referral/RaKit'

/** Resposta de `GET /admin/clients/:id/referrals`. */
export interface ClientReferrals {
  /** Programa ligado — desligado, não há vínculo manual (§4.8). */
  active: boolean
  code: string | null
  referredBy: { id: string; name: string; state: ReferralStateKey } | null
  stats: { fez: number; valeram: number; earnedBreads: number }
  referrals: Array<{ id: string; name: string; createdAt: string; state: ReferralStateKey }>
}

/** Carrega as indicações do cliente (A5). `null` enquanto não chegou — ou se falhou. */
export function useClientReferrals(clientId: string, reloadKey: number): ClientReferrals | null {
  const [data, setData] = useState<ClientReferrals | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/admin/clients/${clientId}/referrals`)
        if (res.ok && !cancelled) setData((await res.json()) as ClientReferrals)
      } catch {
        // silencioso — sem os dados, a linha e o card simplesmente não aparecem
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, reloadKey])
  return data
}

/**
 * Linha do card de cadastro, logo abaixo de "Membro desde" (handoff `RAClientGeral`):
 * "Indicação de João Silva ›" (atalho para o cliente) ou a ação "Vincular indicação".
 * Com o programa desligado e sem indicação, a linha não aparece — não há o que vincular.
 *
 * "Indicação de", e não o "Indicado por" do handoff: a linha fala de um cliente específico e o
 * sistema não sabe o gênero dele (V-41).
 */
export function ReferredByRow({
  data,
  onOpenClient,
  onLink,
}: {
  data: ClientReferrals
  onOpenClient: (id: string) => void
  onLink: () => void
}) {
  const rowStyle = {
    width: '100%',
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'none',
    border: 'none',
    borderTop: '1px solid var(--color-border-2)',
    cursor: 'pointer',
    fontFamily: RF_BODY,
    textAlign: 'left' as const,
  }

  if (data.referredBy) {
    const by = data.referredBy
    return (
      <button type="button" onClick={() => onOpenClient(by.id)} aria-label={`Indicação de ${by.name} — abrir cliente`} style={rowStyle}>
        <Icon name="gift" size={20} stroke={1.9} color="var(--color-accent)" />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text-sec)' }}>Indicação de</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', textAlign: 'right' }}>{by.name}</span>
        <Icon name="chevR" size={16} color="var(--color-accent)" />
      </button>
    )
  }

  if (!data.active) return null

  return (
    <button type="button" onClick={onLink} style={{ ...rowStyle, color: 'var(--color-accent)', fontWeight: 700, fontSize: 14 }}>
      <Icon name="link" size={20} stroke={1.9} color="var(--color-accent)" />
      Vincular indicação
    </button>
  )
}

/**
 * Card "Indicações" do detalhe do cliente (handoff `RAClientGeral`): o código dele, fez / valeram /
 * pãezins ganhos (indicações + metas) e a lista curta com o estado de cada uma.
 */
export function IndicacoesCard({ data }: { data: ClientReferrals }) {
  const stats: Array<[number, string]> = [
    [data.stats.fez, 'fez'],
    [data.stats.valeram, 'valeram'],
    [data.stats.earnedBreads, 'pãezins ganhos'],
  ]
  return (
    <RefCard pad={16} style={{ boxShadow: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: 'var(--color-gold-soft)',
            color: 'var(--color-accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="gift" size={18} />
        </div>
        <h3 style={{ flex: 1, margin: 0, fontFamily: RF_BODY, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>Indicações</h3>
        {data.code && (
          <span style={{ fontFamily: RF_BODY, fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 600 }}>código {data.code}</span>
        )}
      </div>

      <div style={{ display: 'flex', margin: '14px 0 6px', background: 'var(--color-surface-alt)', borderRadius: 14 }}>
        {stats.map(([n, l], i) => (
          <div
            key={l}
            style={{ flex: 1, padding: '10px 6px', textAlign: 'center', borderLeft: i ? '1px solid var(--color-border-2)' : 'none' }}
          >
            <div
              style={{
                fontFamily: RF_DISPLAY,
                fontWeight: 800,
                fontSize: 22,
                color: i === 2 ? 'var(--color-good)' : 'var(--color-text)',
              }}
            >
              {String(n).replace('.', ',')}
            </div>
            <div style={{ fontFamily: RF_BODY, fontSize: 11.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>{l}</div>
          </div>
        ))}
      </div>

      {data.referrals.length === 0 ? (
        <p style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-ter)', margin: '10px 0 0' }}>Nenhuma indicação ainda.</p>
      ) : (
        data.referrals.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 0',
              borderBottom: i < data.referrals.length - 1 ? '1px solid var(--color-border-2)' : 'none',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontFamily: RF_BODY, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
              {r.name}
            </span>
            <span style={{ fontFamily: RF_BODY, fontSize: 11.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>{brtDay(r.createdAt)}</span>
            <RaStatePill state={r.state} />
          </div>
        ))
      )}
    </RefCard>
  )
}
