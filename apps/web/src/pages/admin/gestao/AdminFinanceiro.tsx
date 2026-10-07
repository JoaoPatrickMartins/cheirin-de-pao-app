import { useState, useEffect } from 'react'
import { Icon, Ic } from '../../../components/brand/Icon'
import { apiFetch } from '../../../lib/apiFetch'
import { ReportAppBar } from './RelShared'
import { FinReceita } from './FinReceita'
import { FinDre } from './FinDre'
import { FinGateway } from './FinGateway'
import { FinCaixa } from './FinCaixa'
import { RelPassivo } from './RelPassivo'
import { AdminDespesas } from './despesas/AdminDespesas'
import { AdminContasPagar } from './despesas/AdminContasPagar'
import { AdminDespesasCategorias } from './despesas/AdminDespesasCategorias'
import { RelDespesas } from './despesas/RelDespesas'
import { FinMargem } from './FinMargem'
import { FinMetas } from './FinMetas'
import { FinAliquotas } from './FinAliquotas'
import { FinTendencia } from './FinTendencia'
import { CourierPayouts } from './CourierPayouts'

/**
 * AdminFinanceiro — hub do Financeiro (decisão 8 do plano-financeiro-vendas).
 *
 * Era UMA tela (receita por período). Com despesas, contas a pagar, DRE e fluxo de caixa não cabe
 * mais numa só, então virou hub no mesmo molde de {@link AdminRelatorios}.
 *
 * **A linha divisória com Relatórios:** Financeiro é dinheiro (o que o contador entende);
 * Relatórios é comportamento (o que o operador entende). Por isso o **passivo de crédito** migrou
 * para cá — é linha de balanço, não métrica de cliente.
 */

type FinSub =
  | null
  | 'receita'
  | 'dre'
  | 'gateway'
  | 'caixa'
  | 'despesas'
  | 'rel-despesas'
  | 'contas-pagar'
  | 'categorias'
  | 'passivo'
  | 'margem'
  | 'metas'
  | 'aliquotas'
  | 'tendencia'
  | 'entregadores'

interface HubItem {
  key: Exclude<FinSub, null>
  icon: keyof typeof Ic
  titulo: string
  descricao: string
}

const GROUPS: Array<{ title: string; items: HubItem[] }> = [
  {
    title: 'Resultado',
    items: [
      { key: 'dre', icon: 'doc', titulo: 'DRE', descricao: 'Resultado do mês, caixa e competência' },
      { key: 'tendencia', icon: 'trend', titulo: 'Tendência', descricao: 'Receita, resultado e caixa mês a mês' },
      { key: 'receita', icon: 'trend', titulo: 'Receita', descricao: 'Por período, tipo e condomínio' },
      { key: 'despesas', icon: 'wallet', titulo: 'Despesas', descricao: 'Lançar, categorizar e acompanhar' },
      { key: 'rel-despesas', icon: 'percent', titulo: 'Relatório de despesas', descricao: 'Para onde o dinheiro foi, e se mudou' },
      { key: 'margem', icon: 'trend', titulo: 'Margem & equilíbrio', descricao: 'Onde a margem está e quantos pães pagam o mês' },
      { key: 'metas', icon: 'star', titulo: 'Metas do mês', descricao: 'Realizado × previsto, com ritmo' },
    ],
  },
  {
    title: 'Caixa e obrigações',
    items: [
      { key: 'caixa', icon: 'repeat', titulo: 'Fluxo de caixa', descricao: 'Entradas, saídas e saldo do período' },
      { key: 'contas-pagar', icon: 'clock', titulo: 'Contas a pagar', descricao: 'O que vence e o que atrasou' },
      { key: 'entregadores', icon: 'wallet', titulo: 'Pagamentos dos entregadores', descricao: 'Propostas da semana: aprovar vira despesa' },
      { key: 'gateway', icon: 'card', titulo: 'Conciliação de gateway', descricao: 'Bruto, taxa e líquido recebido' },
      { key: 'passivo', icon: 'coin', titulo: 'Passivo de crédito', descricao: 'Quanto a empresa deve em pão' },
    ],
  },
  {
    title: 'Configuração',
    items: [
      { key: 'categorias', icon: 'list', titulo: 'Categorias de despesa', descricao: 'Grupos do DRE e despesas fixas' },
      { key: 'aliquotas', icon: 'percent', titulo: 'Alíquotas do gateway', descricao: 'Base da taxa estimada no DRE' },
    ],
  },
]

/**
 * Tier seguinte — visível como "Em breve".
 *
 * Vazio: tudo o que estava listado aqui foi entregue. "Margem" virou `FinMargem`, "Tendência"
 * virou `FinTendencia` e o "Pacote do contador" virou um botão na própria tela do DRE — é de lá
 * que o mês é fechado, e quem acabou de fechar agosto é quem manda o pacote no minuto seguinte.
 *
 * A seção inteira some quando a lista está vazia: um cabeçalho "Em breve" sem nada embaixo é
 * ruído, não roadmap.
 */
const EM_BREVE: Array<{ icon: keyof typeof Ic; titulo: string; descricao: string }> = []

export function AdminFinanceiro({ onBack }: { onBack: () => void }) {
  const [sub, setSub] = useState<FinSub>(null)
  const [payableCount, setPayableCount] = useState(0)
  const backToHub = () => setSub(null)

  // Badge de contas a pagar. Depende de `sub` porque este componente NÃO desmonta ao entrar numa
  // subtela — um efeito de mount deixaria o número congelado no que era ao abrir o hub, e o admin
  // acabaria de pagar uma conta e veria o badge intacto. (Mesmo padrão de AdminGestao.)
  useEffect(() => {
    if (sub !== null) return
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/admin/expenses/payable')
        if (!res.ok || cancelled) return
        const rows = (await res.json()) as unknown[]
        if (!cancelled) setPayableCount(rows.length)
      } catch {
        // falha silenciosa — sem badge, o hub continua navegável
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sub])

  if (sub === 'dre') return <FinDre onBack={backToHub} />
  if (sub === 'receita') return <FinReceita onBack={backToHub} />
  if (sub === 'gateway') return <FinGateway onBack={backToHub} />
  if (sub === 'caixa') return <FinCaixa onBack={backToHub} />
  if (sub === 'despesas') return <AdminDespesas onBack={backToHub} />
  if (sub === 'rel-despesas') return <RelDespesas onBack={backToHub} />
  if (sub === 'contas-pagar') return <AdminContasPagar onBack={backToHub} />
  if (sub === 'categorias') return <AdminDespesasCategorias onBack={backToHub} />
  if (sub === 'passivo') return <RelPassivo onBack={backToHub} />
  if (sub === 'margem') return <FinMargem onBack={backToHub} />
  if (sub === 'metas') return <FinMetas onBack={backToHub} />
  if (sub === 'aliquotas') return <FinAliquotas onBack={backToHub} />
  if (sub === 'tendencia') return <FinTendencia onBack={backToHub} />
  if (sub === 'entregadores') return <CourierPayouts onBack={backToHub} />

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Financeiro" onBack={onBack} />

      <div
        style={{
          overflow: 'auto',
          flex: 1,
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {GROUPS.map((group) => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionTitle>{group.title}</SectionTitle>
            {group.items.map((item) => (
              <HubCard
                key={item.key}
                icon={item.icon}
                titulo={item.titulo}
                descricao={item.descricao}
                badge={item.key === 'contas-pagar' ? payableCount : 0}
                onClick={() => setSub(item.key)}
              />
            ))}
          </div>
        ))}

        {EM_BREVE.length > 0 && (
          <>
            <SectionTitle>Em breve</SectionTitle>
            {EM_BREVE.map((item) => (
              <HubCard key={item.titulo} icon={item.icon} titulo={item.titulo} descricao={item.descricao} soon />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--color-text)',
        margin: '8px 0 -2px',
      }}
    >
      {children}
    </p>
  )
}

interface HubCardProps {
  icon: keyof typeof Ic
  titulo: string
  descricao: string
  badge?: number
  onClick?: () => void
  soon?: boolean
}

function HubCard({ icon, titulo, descricao, badge = 0, onClick, soon }: HubCardProps) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      aria-disabled={soon}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 15,
        cursor: soon ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
        opacity: soon ? 0.62 : 1,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={22} color="var(--color-accent)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14.5,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {titulo}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-ter)',
            margin: '1px 0 0',
            lineHeight: 1.3,
          }}
        >
          {descricao}
        </p>
      </div>

      {badge > 0 && (
        <span
          aria-label={`${badge} ${badge === 1 ? 'conta a pagar' : 'contas a pagar'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 24,
            height: 24,
            padding: '0 8px',
            borderRadius: 999,
            background: 'var(--color-accent)',
            color: '#FAF5EC',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}

      {soon ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: 99,
            background: 'var(--color-gold-soft)',
            color: '#8A6A00',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Em breve
        </span>
      ) : (
        <Icon name="chevR" size={18} color="var(--color-text-ter)" />
      )}
    </button>
  )
}
