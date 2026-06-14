import { Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'

export function AdminLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)' }}>
      <div style={{ padding: '1rem' }}>
        Painel Admin — Fase 3
        <Outlet />
      </div>
    </div>
  )
}
