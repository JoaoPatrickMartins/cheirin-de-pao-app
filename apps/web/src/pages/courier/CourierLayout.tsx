import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'

export function CourierLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'COURIER') return <Navigate to="/" replace />
  // 1º acesso sem senha: força a definição antes de usar o app.
  if (user.hasPassword === false) return <Navigate to="/set-password" replace />

  // A CourierScreen controla seu próprio fundo, min-height e paddings.
  return <Outlet />
}
