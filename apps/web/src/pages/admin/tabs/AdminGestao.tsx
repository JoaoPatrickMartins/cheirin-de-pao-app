import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AdminHead } from '../../../components/admin/AdminHead'
import { Icon } from '../../../components/brand/Icon'
import { useAuth } from '../../../hooks/useAuth'
import { AdminCombos } from '../gestao/AdminCombos'
import { AdminMarket } from '../gestao/AdminMarket'
import { AdminAvulso } from '../gestao/AdminAvulso'
import { AdminPedidoMinimo } from '../gestao/AdminPedidoMinimo'
import { AdminBloqueiosLimites } from '../gestao/AdminBloqueiosLimites'
import { AdminCortes } from '../gestao/AdminCortes'
import { AdminFornecedores } from '../gestao/AdminFornecedores'
import { AdminEntregadores } from '../gestao/AdminEntregadores'
import { AdminGanchos } from '../gestao/AdminGanchos'
import { AdminGancho } from '../gestao/AdminGancho'
import { AdminNotificacoes } from '../gestao/AdminNotificacoes'
import { AdminCondos } from '../gestao/AdminCondos'
import { AdminPagamentos } from '../gestao/AdminPagamentos'
import { AdminFinanceiro } from '../gestao/AdminFinanceiro'
import { AdminRelatorios } from '../gestao/AdminRelatorios'

// ------------------------------------------------------------------ tipos
type AdminGestaoSub =
  | null
  | 'combos'
  | 'market'
  | 'avulso'
  | 'pedido-minimo'
  | 'restricoes'
  | 'cortes'
  | 'fornecedores'
  | 'entregadores'
  | 'ganchos'
  | 'gancho-config'
  | 'notificacoes'
  | 'condos'
  | 'pagamentos'
  | 'financeiro'
  | 'relatorios'

interface HubItem {
  key: AdminGestaoSub
  icon: string
  titulo: string
  descricao: string
}

const HUB_ITEMS: HubItem[] = [
  { key: 'combos', icon: 'bag', titulo: 'Combos e promoções', descricao: 'Criar, editar, descontos' },
  { key: 'market', icon: 'bag', titulo: 'Além do Pãozin', descricao: 'Mini market: produtos, categorias, estoque' },
  { key: 'avulso', icon: 'coin', titulo: 'Compra personalizada', descricao: 'Limite e preço por pão' },
  { key: 'pedido-minimo', icon: 'bag', titulo: 'Pedido mínimo', descricao: 'Mínimo da agenda e do pedido único' },
  { key: 'restricoes', icon: 'calendar', titulo: 'Bloqueios e limites', descricao: 'Dias bloqueados e teto de pedidos por dia' },
  { key: 'cortes', icon: 'clock', titulo: 'Horários de corte', descricao: 'Prazo de pedido por turno' },
  { key: 'fornecedores', icon: 'factory', titulo: 'Fornecedores', descricao: 'Padarias e preço do pão' },
  { key: 'entregadores', icon: 'truck', titulo: 'Entregadores', descricao: 'Equipe e disponibilidade' },
  { key: 'ganchos', icon: 'pin', titulo: 'Solicitação de Gancho', descricao: 'Entregas de gancho de porta' },
  { key: 'gancho-config', icon: 'gift', titulo: 'Regras do Gancho', descricao: 'Mínimo do grátis e preço extra' },
  { key: 'notificacoes', icon: 'bell', titulo: 'Notificações', descricao: 'Ative ou desative os avisos' },
  { key: 'condos', icon: 'building', titulo: 'Condomínios', descricao: 'Locais atendidos' },
  { key: 'pagamentos', icon: 'card', titulo: 'Pagamentos', descricao: 'Status e estornos' },
  { key: 'financeiro', icon: 'trend', titulo: 'Financeiro', descricao: 'Receita por período' },
  { key: 'relatorios', icon: 'doc', titulo: 'Relatórios', descricao: 'Acessos, login e conversão' },
]

// ------------------------------------------------------------------ componente
export function AdminGestao() {
  const [sub, setSub] = useState<AdminGestaoSub>(null)
  const { logout } = useAuth()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const navigate = useNavigate()

  const onBack = () => setSub(null)

  if (sub === 'combos') return <AdminCombos onBack={onBack} />
  if (sub === 'market') return <AdminMarket onBack={onBack} />
  if (sub === 'avulso') return <AdminAvulso onBack={onBack} />
  if (sub === 'pedido-minimo') return <AdminPedidoMinimo onBack={onBack} />
  if (sub === 'restricoes') return <AdminBloqueiosLimites onBack={onBack} />
  if (sub === 'cortes') return <AdminCortes onBack={onBack} />
  if (sub === 'fornecedores') return <AdminFornecedores onBack={onBack} />
  if (sub === 'entregadores') return <AdminEntregadores onBack={onBack} />
  if (sub === 'ganchos') return <AdminGanchos onBack={onBack} />
  if (sub === 'gancho-config') return <AdminGancho onBack={onBack} />
  if (sub === 'notificacoes') return <AdminNotificacoes onBack={onBack} />
  if (sub === 'condos') return <AdminCondos onBack={onBack} />
  if (sub === 'pagamentos') return <AdminPagamentos onBack={onBack} />
  if (sub === 'financeiro') return <AdminFinanceiro onBack={onBack} />
  if (sub === 'relatorios') return <AdminRelatorios onBack={onBack} />

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

        <HubCard
          icon="lock"
          titulo="Trocar senha"
          descricao="Alterar a senha de acesso"
          onClick={() => navigate('/change-password')}
        />

        {/* Sair — fim do menu de gestão */}
        <button
          type="button"
          onClick={() => setShowLogoutDialog(true)}
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
            marginTop: 6,
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
            <Icon name="logout" size={22} color="var(--color-bad, #C2410C)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-bad, #C2410C)', margin: 0, lineHeight: 1.3 }}>
              Sair da conta
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)', margin: '1px 0 0', lineHeight: 1.3 }}>
              Encerrar a sessão deste dispositivo
            </p>
          </div>
        </button>
      </div>

      {/* Dialog de confirmação de logout (D-09) */}
      {showLogoutDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-logout-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 360 }}>
            <h2
              id="dialog-logout-title"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text)', margin: '0 0 8px' }}
            >
              Sair da conta?
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: '0 0 24px' }}>
              Você será redirecionado para a tela de login.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowLogoutDialog(false)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  border: '1.5px solid var(--color-border)',
                  background: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                Continuar na conta
              </button>
              <button
                onClick={logout}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--color-espresso)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
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

