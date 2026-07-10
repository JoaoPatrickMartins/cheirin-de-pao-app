import { useState } from 'react'
import { Icon, Ic } from '../../../components/brand/Icon'
import { ReportAppBar } from './RelShared'
import { RelAcesso } from './RelAcesso'
import { RelRetencao } from './RelRetencao'
import { RelPassivo } from './RelPassivo'
import { RelCondominios } from './RelCondominios'
import { RelEntregas } from './RelEntregas'
import { RelDesperdicio } from './RelDesperdicio'
import { RelAgenda } from './RelAgenda'
import { RelPagamentos } from './RelPagamentos'

// ------------------------------------------------------------------ tipos
type RelSub =
  | null
  | 'acesso'
  | 'retencao'
  | 'passivo'
  | 'condominios'
  | 'entregas'
  | 'desperdicio'
  | 'agenda'
  | 'pagamentos'

interface HubItem {
  key: Exclude<RelSub, null>
  icon: keyof typeof Ic
  titulo: string
  descricao: string
}

interface AdminRelatoriosProps {
  onBack: () => void
}

const GROUPS: Array<{ title: string; items: HubItem[] }> = [
  {
    title: 'Aquisição & clientes',
    items: [
      { key: 'acesso', icon: 'users', titulo: 'Aquisição', descricao: 'Acessos, login e conversão' },
      { key: 'retencao', icon: 'repeat', titulo: 'Recorrência & retenção', descricao: 'Recarga, churn, recompra e ativação' },
      { key: 'passivo', icon: 'wallet', titulo: 'Passivo de crédito', descricao: 'Créditos em circulação (R$)' },
      { key: 'condominios', icon: 'building', titulo: 'Condomínios', descricao: 'Ranking por receita e volume' },
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
  { icon: 'phone', titulo: 'Custo de OTP por canal', descricao: 'Volume e custo de SMS vs e-mail' },
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
  if (sub === 'passivo') return <RelPassivo onBack={backToHub} />
  if (sub === 'condominios') return <RelCondominios onBack={backToHub} />
  if (sub === 'entregas') return <RelEntregas onBack={backToHub} />
  if (sub === 'desperdicio') return <RelDesperdicio onBack={backToHub} />
  if (sub === 'agenda') return <RelAgenda onBack={backToHub} />
  if (sub === 'pagamentos') return <RelPagamentos onBack={backToHub} />

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
