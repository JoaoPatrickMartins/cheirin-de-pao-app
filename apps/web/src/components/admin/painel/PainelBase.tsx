import { KpiCard } from '../KpiCard'
import type { DashboardOverview } from './painel-types'
import { fmtInt, fmtPct } from './painel-types'

/**
 * Faixa 4 do Painel — base de clientes e crescimento.
 *
 * Todos os quatro números **já eram calculados** por `/admin/reports/retention` e nenhum deles
 * aparecia no painel. Duas trocas deliberadas em relação à grade antiga:
 *
 *   - **Clientes ATIVOS** no lugar de "Clientes". O total cadastrado só cresce e nunca gera
 *     decisão; quem tem agenda ativa é a base real do negócio recorrente.
 *   - **Em risco** entra no lugar de "Condomínios" (número quase constante que ocupava um quarto
 *     da grade). Saldo zerado sem recarga é o sinal de churn do modelo pré-pago — é o KPI que pede
 *     ação hoje.
 */

interface PainelBaseProps {
  data: DashboardOverview | null
}

export function PainelBase({ data }: PainelBaseProps) {
  if (!data) return null
  const { base } = data

  return (
    <div style={{ marginBottom: 12 }}>
      <SectionLabel>Base e crescimento</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <KpiCard
          icon="users"
          value={fmtInt(base.activeClients)}
          label="Clientes ativos"
          pill={base.newClients > 0 ? { text: `+${base.newClients}`, tone: 'good' } : undefined}
        />
        <KpiCard
          icon="repeat"
          value={fmtPct(base.autoRechargeRate)}
          label="Recarga automática"
        />
        <KpiCard
          icon="alert"
          value={fmtInt(base.atRisk)}
          // O rótulo diz o CRITÉRIO, não só o nome: "em risco" sozinho não é acionável.
          label="Em risco · saldo zerado"
          pill={base.atRisk > 0 ? { text: 'atenção', tone: 'neutral' } : undefined}
        />
        <KpiCard icon="user" value={fmtInt(base.newClients)} label="Novos no período" />
      </div>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-ter)',
        margin: '0 0 8px',
      }}
    >
      {children}
    </p>
  )
}
