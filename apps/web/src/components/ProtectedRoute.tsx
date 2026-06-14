import { Navigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { LoadingScreen } from '../pages/auth/LoadingScreen'

interface ProtectedRouteProps {
  requiredRole: 'CLIENT' | 'COURIER' | 'ADMIN'
  children: React.ReactNode
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />

  if (!user) return <Navigate to="/" replace />

  if (user.role !== requiredRole) return <Navigate to="/" replace />

  return <>{children}</>
}
