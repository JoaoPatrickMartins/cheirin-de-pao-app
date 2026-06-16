import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'
import { AdminBottomNav } from '../../components/admin/AdminBottomNav'
import { AdminPainel } from './tabs/AdminPainel'
import { AdminPedido } from './tabs/AdminPedido'
import { AdminEntregas } from './tabs/AdminEntregas'
import { AdminClientes } from './tabs/AdminClientes'
import { AdminGestao } from './tabs/AdminGestao'

type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'

export function AdminLayout() {
  const { user, isLoading } = useAuth()
  const [tab, setTab] = useState<AdminTab>('painel')

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      {tab === 'painel' && <AdminPainel onNavigate={setTab} />}
      {tab === 'pedido' && <AdminPedido />}
      {tab === 'entregas' && <AdminEntregas />}
      {tab === 'clientes' && <AdminClientes />}
      {tab === 'gestao' && <AdminGestao />}
      <AdminBottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  )
}
