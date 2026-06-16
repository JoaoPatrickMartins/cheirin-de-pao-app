import { useState } from 'react'
import { AdminHead } from '../../../components/admin/AdminHead'
import { Icon } from '../../../components/brand/Icon'
import { AdminCombos } from '../gestao/AdminCombos'
import { AdminAvulso } from '../gestao/AdminAvulso'
import { AdminFornecedores } from '../gestao/AdminFornecedores'
import { AdminEntregadores } from '../gestao/AdminEntregadores'
import { AdminCondos } from '../gestao/AdminCondos'

// ------------------------------------------------------------------ tipos
type AdminGestaoSub =
  | null
  | 'combos'
  | 'avulso'
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
  if (sub === 'fornecedores') return <AdminFornecedores onBack={onBack} />
  if (sub === 'entregadores') return <AdminEntregadores onBack={onBack} />
  if (sub === 'condos') return <AdminCondos onBack={onBack} />
  if (sub === 'pagamentos') return <PaginaEmBreve titulo="Pagamentos" onBack={onBack} />
  if (sub === 'financeiro') return <PaginaEmBreve titulo="Financeiro" onBack={onBack} />

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

// ------------------------------------------------------------------ placeholder para plano 07-12
interface PaginaEmBreveProps {
  titulo: string
  onBack: () => void
}

function PaginaEmBreve({ titulo, onBack }: PaginaEmBreveProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBarSimples titulo={titulo} onBack={onBack} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-ter)',
            textAlign: 'center',
          }}
        >
          Em breve — plano 07-12
        </p>
      </div>
    </div>
  )
}

interface AppBarSimplesProps {
  titulo: string
  onBack: () => void
}

function AppBarSimples({ titulo, onBack }: AppBarSimplesProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px 14px',
      }}
    >
      <button
        type="button"
        aria-label="Voltar"
        onClick={onBack}
        style={{
          background: 'var(--color-surface-2)',
          border: 'none',
          width: 36,
          height: 36,
          borderRadius: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Icon name="arrowL" size={18} color="var(--color-text)" />
      </button>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--color-text)',
          margin: 0,
        }}
      >
        {titulo}
      </h2>
    </div>
  )
}
