import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'
import { AdminBottomNav } from '../../components/admin/AdminBottomNav'
import { AdminPainel } from './tabs/AdminPainel'

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
      {tab === 'pedido' && <div />}
      {tab === 'entregas' && <div />}
      {tab === 'clientes' && <div />}
      {tab === 'gestao' && <div />}
      <AdminBottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  )
}
