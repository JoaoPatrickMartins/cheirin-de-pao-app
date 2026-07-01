import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'

export function CourierLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'COURIER') return <Navigate to="/" replace />

  // A CourierScreen controla seu próprio fundo, min-height e paddings.
  return <Outlet />
}
