import { useState } from 'react'
import { AdminHead } from '../../../components/admin/AdminHead'
import { Icon } from '../../../components/brand/Icon'
import { AdminCombos } from '../gestao/AdminCombos'
import { AdminAvulso } from '../gestao/AdminAvulso'
import { AdminCortes } from '../gestao/AdminCortes'
import { AdminFornecedores } from '../gestao/AdminFornecedores'
import { AdminEntregadores } from '../gestao/AdminEntregadores'
import { AdminCondos } from '../gestao/AdminCondos'
import { AdminPagamentos } from '../gestao/AdminPagamentos'
import { AdminFinanceiro } from '../gestao/AdminFinanceiro'

// ------------------------------------------------------------------ tipos
type AdminGestaoSub =
  | null
  | 'combos'
  | 'avulso'
  | 'cortes'
  | 'fornecedores'
  | 'entregadores'
  | 'condos'
  | 'pagamentos'
  | 'financeiro'

interface HubItem {
  key: AdminGestaoSub
  icon: string
  titulo: string
  descricao: string
}

const HUB_ITEMS: HubItem[] = [
  { key: 'combos', icon: 'bag', titulo: 'Combos e promoções', descricao: 'Criar, editar, descontos' },
  { key: 'avulso', icon: 'coin', titulo: 'Compra personalizada', descricao: 'Limite e preço por pão' },
  { key: 'cortes', icon: 'clock', titulo: 'Horários de corte', descricao: 'Prazo de pedido por turno' },
  { key: 'fornecedores', icon: 'factory', titulo: 'Fornecedores', descricao: 'Padarias e preço do pão' },
  { key: 'entregadores', icon: 'truck', titulo: 'Entregadores', descricao: 'Equipe e disponibilidade' },
  { key: 'condos', icon: 'building', titulo: 'Condomínios', descricao: 'Locais atendidos' },
  { key: 'pagamentos', icon: 'card', titulo: 'Pagamentos', descricao: 'Status e estornos' },
  { key: 'financeiro', icon: 'trend', titulo: 'Financeiro', descricao: 'Receita por período' },
]

// ------------------------------------------------------------------ componente
export function AdminGestao() {
  const [sub, setSub] = useState<AdminGestaoSub>(null)

  const onBack = () => setSub(null)

  if (sub === 'combos') return <AdminCombos onBack={onBack} />
  if (sub === 'avulso') return <AdminAvulso onBack={onBack} />
  if (sub === 'cortes') return <AdminCortes onBack={onBack} />
  if (sub === 'fornecedores') return <AdminFornecedores onBack={onBack} />
  if (sub === 'entregadores') return <AdminEntregadores onBack={onBack} />
  if (sub === 'condos') return <AdminCondos onBack={onBack} />
  if (sub === 'pagamentos') return <AdminPagamentos onBack={onBack} />
  if (sub === 'financeiro') return <AdminFinanceiro onBack={onBack} />

  // Hub principal
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminHead titulo="Gestão" sub="Configurações da operação" />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '0 20px 24px',
        }}
      >
        {HUB_ITEMS.map((item) => (
          <HubCard
            key={item.key}
            icon={item.icon}
            titulo={item.titulo}
            descricao={item.descricao}
            onClick={() => setSub(item.key)}
          />
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes
interface HubCardProps {
  icon: string
  titulo: string
  descricao: string
  onClick: () => void
}

function HubCard({ icon, titulo, descricao, onClick }: HubCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 15,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Avatar com ícone accent */}
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
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={22} color="var(--color-accent)" />
      </div>

      {/* Texto */}
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

      {/* Chevron */}
      <Icon name="chevR" size={18} color="var(--color-text-ter)" />
    </button>
  )
}

