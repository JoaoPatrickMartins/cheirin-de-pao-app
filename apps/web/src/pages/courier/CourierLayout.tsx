import { Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'

export function CourierLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'COURIER') return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)' }}>
      <div style={{ padding: '1rem' }}>
        Área do Entregador — Fase 3
        <Outlet />
      </div>
    </div>
  )
}
