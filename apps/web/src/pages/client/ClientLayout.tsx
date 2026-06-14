import { Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'

export function ClientLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)' }}>
      <div style={{ padding: '1rem' }}>
        Área do Cliente — Fase 3
        <Outlet />
      </div>
    </div>
  )
}
