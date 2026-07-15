import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { LoadingScreen } from '../pages/auth/LoadingScreen'
import { authHome } from '../lib/roleRoutes'

/**
 * Guarda das rotas públicas (splash `/`, `/login`, `/register`).
 *
 * A sessão persiste no localStorage e é reidratada pelo AuthProvider ao abrir o
 * app (inclusive ao reabrir o PWA/navegador). Sem esta guarda, o usuário logado
 * caía sempre na splash com os botões "Entrar/Criar conta" e refazia o login à
 * toa. Aqui, quem já está autenticado vai direto para a home do seu perfil.
 */
export function RedirectIfAuthenticated() {
  const { user, isLoading } = useAuth()

  // Aguarda a reidratação da sessão antes de decidir — evita flash da splash.
  if (isLoading) return <LoadingScreen />

  if (user) return <Navigate to={authHome(user)} replace />

  return <Outlet />
}
