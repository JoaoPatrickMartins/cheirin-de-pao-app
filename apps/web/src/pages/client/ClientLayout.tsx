import { Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'
import { ClientTabBar } from '../../components/client/ClientTabBar'

export function ClientLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <Outlet />
      <ClientTabBar />
    </div>
  )
}
