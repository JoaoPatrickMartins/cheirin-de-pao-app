import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import type { LoginMethod } from '../contexts/AuthContext'
import { apiFetch } from './apiFetch'
import { needsPasswordSetup, roleRoutes } from './roleRoutes'

/** Resposta de qualquer caminho que abre sessão: /auth/login, /auth/otp/verify, Google (claim). */
export interface AuthSessionResponse {
  accessToken: string
  refreshToken: string
  hasPassword?: boolean
  mustSetPassword?: boolean
  user: { id: string; role: string; name: string; creditBalance?: number }
}

/**
 * Pós-autenticação comum a login por senha, código e Google: guarda a sessão, força o
 * "defina sua senha" quando precisa (needsPasswordSetup), hidrata o perfil do cliente e leva à home
 * do papel. Fonte única — antes cada tela repetia isto.
 */
export function useFinishAuth() {
  const auth = useAuth()
  const navigate = useNavigate()

  return useCallback(
    (data: AuthSessionResponse, method: LoginMethod, opts: { replace?: boolean } = {}) => {
      const role = data.user.role as 'CLIENT' | 'COURIER' | 'ADMIN'
      auth.login(
        data.accessToken,
        data.refreshToken,
        {
          id: data.user.id,
          role,
          name: data.user.name,
          creditBalance: data.user.creditBalance ?? 0,
          hasPassword: data.hasPassword,
          mustSetPassword: data.mustSetPassword,
        },
        method,
      )

      if (needsPasswordSetup(data)) {
        navigate('/set-password', { replace: opts.replace })
        return
      }

      if (role === 'CLIENT') {
        apiFetch('/client/profile')
          .then((pr) => {
            if (pr.ok) pr.json().then((profile) => auth.updateUser(profile)).catch(() => {})
          })
          .catch(() => {})
      }
      navigate(roleRoutes[role] ?? '/client', { replace: opts.replace })
    },
    [auth, navigate],
  )
}
