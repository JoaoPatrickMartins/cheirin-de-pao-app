import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'
import { AdminBottomNav } from '../../components/admin/AdminBottomNav'
import { AdminPainel } from './tabs/AdminPainel'
import { AdminCompra } from './tabs/AdminCompra'
import { AdminSeparacao } from './tabs/AdminSeparacao'
import { AdminEntregas, type HistFilter } from './tabs/AdminEntregas'
import { AdminClientes } from './tabs/AdminClientes'
import { AdminGestao } from './tabs/AdminGestao'
import { AdminNotificationsScreen } from './AdminNotificationsScreen'
import { NotifProvider } from '../../contexts/NotifContext'
import { useOneSignalRegister } from '../../hooks/useOneSignalRegister'
import { useOneSignalDeepLink } from '../../hooks/useOneSignalDeepLink'

type AdminTab = 'painel' | 'pedido' | 'separacao' | 'entregas' | 'clientes' | 'gestao'

// Deep-link opcional para a aba Entregas (banner de pedidos parados no Painel).
interface EntregasIntent {
  segment: 'hoje' | 'historico'
  filter: HistFilter
}

export function AdminLayout() {
  const { user, isLoading } = useAuth()
  const [tab, setTabRaw] = useState<AdminTab>('painel')
  const [entregasIntent, setEntregasIntent] = useState<EntregasIntent | null>(null)
  // Cliente a abrir direto na aba Clientes (ex.: "Ver cliente" na fila de ganchos).
  const [pendingClienteId, setPendingClienteId] = useState<string | null>(null)
  const [showNotif, setShowNotif] = useState(false)
  // Registra o player_id do OneSignal do admin + habilita deep link de push.
  useOneSignalRegister()
  useOneSignalDeepLink()

  // O sino (NotifBell, dentro do AdminHead) dispara este evento window ao ser tocado.
  useEffect(() => {
    const open = () => setShowNotif(true)
    window.addEventListener('cdp:open-admin-notifications', open)
    return () => window.removeEventListener('cdp:open-admin-notifications', open)
  }, [])

  // "Ver cliente" (na fila de ganchos) dispara este evento: troca para a aba Clientes
  // e abre o detalhe do cliente. Como a aba Clientes é desmontada quando não ativa,
  // o id é consumido no mount de AdminClientes (via initialClientId).
  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<{ clientId?: string }>).detail?.clientId
      if (!id) return
      setPendingClienteId(id)
      setTabRaw('clientes')
    }
    window.addEventListener('cdp:open-admin-client', open)
    return () => window.removeEventListener('cdp:open-admin-client', open)
  }, [])

  // Navegação normal (bottom nav) limpa qualquer deep-link pendente para que o
  // intent não "grude" ao voltar para Entregas/Clientes manualmente.
  const setTab = (t: AdminTab) => {
    setEntregasIntent(null)
    setPendingClienteId(null)
    setTabRaw(t)
  }

  // Navegação com deep-link (a partir do Painel): guarda o intent e troca de aba.
  const navigateWithIntent = (t: AdminTab, intent?: { segment: 'historico'; filter: 'parados' }) => {
    setEntregasIntent(intent ?? null)
    setTabRaw(t)
  }

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />
  // 1º acesso sem senha: força a definição antes de usar o painel.
  if (user.hasPassword === false) return <Navigate to="/set-password" replace />

  return (
    <NotifProvider>
      <div
        style={{
          minHeight: '100dvh',
          background: 'var(--color-app-bg)',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        }}
      >
        {tab === 'painel' && <AdminPainel onNavigate={navigateWithIntent} />}
        {tab === 'pedido' && <AdminCompra />}
        {tab === 'separacao' && <AdminSeparacao />}
        {tab === 'entregas' && (
          <AdminEntregas initialSegment={entregasIntent?.segment} initialFilter={entregasIntent?.filter} />
        )}
        {tab === 'clientes' && <AdminClientes initialClientId={pendingClienteId} />}
        {tab === 'gestao' && <AdminGestao />}
        <AdminBottomNav activeTab={tab} onTabChange={setTab} />
        {showNotif && <AdminNotificationsScreen onBack={() => setShowNotif(false)} />}
      </div>
    </NotifProvider>
  )
}
