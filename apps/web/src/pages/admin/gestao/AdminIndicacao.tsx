import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { RF_BODY } from '../../../components/client/referral/RefPrimitives'
import { RaAppBar } from '../../../components/admin/referral/RaKit'
import { IndicacaoConfig } from './IndicacaoConfig'
import { IndicacoesLista } from './IndicacoesLista'
import { RelIndicacoes } from './RelIndicacoes'

type Section = 'config' | 'lista'

/**
 * A2 — Hub do Indique e Ganhe (handoff `RAHub`): segmento Configuração · Indicações, com a
 * contagem "em análise" na aba Indicações, e o atalho do relatório (A6) no topo. O relatório abre
 * por aqui mesmo, e o voltar dele devolve ao hub.
 */
export function AdminIndicacao({ onBack }: { onBack: () => void }) {
  const [sec, setSec] = useState<Section>('config')
  const [pending, setPending] = useState(0)
  const [showReport, setShowReport] = useState(false)

  const loadPending = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/referrals/summary')
      if (!res.ok) return
      const data = (await res.json()) as { pendingReview: number }
      setPending(data.pendingReview)
    } catch {
      // sem o número, o segmento continua navegável
    }
  }, [])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  if (showReport) return <RelIndicacoes onBack={() => setShowReport(false)} />

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <RaAppBar
        title="Indique e Ganhe"
        onBack={onBack}
        right={
          (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              aria-label="Relatório de indicações"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="trend" size={19} />
            </button>
          )
        }
      />

      <div style={{ padding: '0 20px 12px' }}>
        <div role="tablist" aria-label="Seções do Indique e Ganhe" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 14, padding: 4 }}>
          {(
            [
              ['config', 'Configuração'],
              ['lista', 'Indicações'],
            ] as const
          ).map(([k, l]) => {
            const on = sec === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setSec(k)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: 11,
                  border: 'none',
                  background: on ? 'var(--color-surface)' : 'transparent',
                  color: on ? 'var(--color-text)' : 'var(--color-text-sec)',
                  boxShadow: on ? 'var(--shadow-soft)' : 'none',
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: RF_BODY,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {l}
                {k === 'lista' && pending > 0 && (
                  <span
                    aria-label={`${pending} em análise`}
                    style={{
                      padding: '1px 7px',
                      borderRadius: 99,
                      background: 'var(--color-gold)',
                      color: 'var(--color-espresso)',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {pending}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {sec === 'config' ? <IndicacaoConfig /> : <IndicacoesLista onChanged={() => void loadPending()} />}
      </div>
    </div>
  )
}
