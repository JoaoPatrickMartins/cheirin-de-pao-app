import { useState } from 'react'
import { Icon, Ic } from '../../../components/brand/Icon'
import { ReportAppBar } from './RelShared'
import { RelAcesso } from './RelAcesso'
import { RelRetencao } from './RelRetencao'
import { RelCondominios } from './RelCondominios'
import { RelEntregas } from './RelEntregas'
import { RelDesperdicio } from './RelDesperdicio'
import { RelAgenda } from './RelAgenda'
import { RelPagamentos } from './RelPagamentos'
import { RelVendas } from './RelVendas'
import { RelClientes } from './RelClientes'
import { RelIndicacoes } from './RelIndicacoes'

// ------------------------------------------------------------------ tipos
type RelSub =
  | null
  | 'acesso'
  | 'retencao'
  | 'condominios'
  | 'entregas'
  | 'desperdicio'
  | 'agenda'
  | 'pagamentos'
  | 'vendas'
  | 'clientes'
  | 'indicacoes'

interface HubItem {
  key: Exclude<RelSub, null>
  icon: keyof typeof Ic
  titulo: string
  descricao: string
}

interface AdminRelatoriosProps {
  onBack: () => void
}

/**
 * Nota de navegação (decisão 8 do plano-financeiro-vendas): o **passivo de crédito** saiu daqui e
 * foi para Gestão › Financeiro. A divisória entre os dois hubs é: Financeiro é dinheiro (o que o
 * contador entende), Relatórios é comportamento (o que o operador entende) — e passivo é linha de
 * balanço, não métrica de cliente.
 */
const GROUPS: Array<{ title: string; items: HubItem[] }> = [
  {
    // Grupo novo (Fase 6). Vem PRIMEIRO de propósito: é a pergunta que o dono faz mais vezes por
    // semana — "o que está vendendo" —, e deixá-la abaixo de aquisição e operação a esconderia
    // atrás de duas rolagens.
    title: 'Vendas & performance',
    items: [
      { key: 'vendas', icon: 'trend', titulo: 'Vendas por período', descricao: 'Mais vendidos, curva ABC, ticket e mix de canal' },
      { key: 'clientes', icon: 'star', titulo: 'Clientes & LTV', descricao: 'Quem sustenta o faturamento e o risco de concentração' },
    ],
  },
  {
    title: 'Aquisição & clientes',
    items: [
      { key: 'acesso', icon: 'users', titulo: 'Aquisição', descricao: 'Acessos, login e conversão' },
      { key: 'retencao', icon: 'repeat', titulo: 'Recorrência & retenção', descricao: 'Recarga, churn, recompra e ativação' },
      { key: 'condominios', icon: 'building', titulo: 'Condomínios', descricao: 'Ranking por receita e volume' },
      { key: 'indicacoes', icon: 'gift', titulo: 'Indicações', descricao: 'Funil, custo × receita e top indicadores' },
    ],
  },
  {
    title: 'Operação & financeiro',
    items: [
      { key: 'entregas', icon: 'truck', titulo: 'Entregas & falhas', descricao: 'Taxa de entrega, motivos de falha' },
      { key: 'desperdicio', icon: 'factory', titulo: 'Desperdício', descricao: 'Pedido ao fornecedor × entregue' },
      { key: 'agenda', icon: 'calendar', titulo: 'Perfil da agenda', descricao: 'Pães/semana, dias e mix de pedidos' },
      { key: 'pagamentos', icon: 'card', titulo: 'Pagamentos', descricao: 'Aprovação, estorno e mix de método' },
    ],
  },
]

// Tier 3 — visíveis como "Em breve" (ainda sem backend)
const EM_BREVE: Array<{ icon: keyof typeof Ic; titulo: string; descricao: string }> = [
  { icon: 'gift', titulo: 'Concessões & suporte', descricao: 'Cortesias de crédito e carga de atendimento' },
  { icon: 'trend', titulo: 'Cohort de receita', descricao: 'Receita por mês de cadastro' },
  { icon: 'user', titulo: 'Sessões & dispositivos', descricao: 'Engajamento ativo por dispositivo' },
]

// ------------------------------------------------------------------ componente
export function AdminRelatorios({ onBack }: AdminRelatoriosProps) {
  const [sub, setSub] = useState<RelSub>(null)
  const backToHub = () => setSub(null)

  if (sub === 'acesso') return <RelAcesso onBack={backToHub} />
  if (sub === 'retencao') return <RelRetencao onBack={backToHub} />
  if (sub === 'condominios') return <RelCondominios onBack={backToHub} />
  if (sub === 'entregas') return <RelEntregas onBack={backToHub} />
  if (sub === 'desperdicio') return <RelDesperdicio onBack={backToHub} />
  if (sub === 'agenda') return <RelAgenda onBack={backToHub} />
  if (sub === 'pagamentos') return <RelPagamentos onBack={backToHub} />
  if (sub === 'vendas') return <RelVendas onBack={backToHub} />
  if (sub === 'clientes') return <RelClientes onBack={backToHub} />
  if (sub === 'indicacoes') return <RelIndicacoes onBack={backToHub} />

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Relatórios" onBack={onBack} />

      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GROUPS.map((group) => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 -2px' }}>
              {group.title}
            </p>
            {group.items.map((item) => (
              <HubCard key={item.key} icon={item.icon} titulo={item.titulo} descricao={item.descricao} onClick={() => setSub(item.key)} />
            ))}
          </div>
        ))}

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 -2px' }}>
          Em breve
        </p>
        {EM_BREVE.map((item) => (
          <HubCard key={item.titulo} icon={item.icon} titulo={item.titulo} descricao={item.descricao} soon />
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ subcomponente
interface HubCardProps {
  icon: keyof typeof Ic
  titulo: string
  descricao: string
  onClick?: () => void
  soon?: boolean
}

function HubCard({ icon, titulo, descricao, onClick, soon }: HubCardProps) {
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
          color: 'var(--color-accent)',
        }}
      >
        <Icon name={icon} size={22} color="var(--color-accent)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
          {titulo}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)', margin: '1px 0 0', lineHeight: 1.3 }}>
          {descricao}
        </p>
      </div>

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
