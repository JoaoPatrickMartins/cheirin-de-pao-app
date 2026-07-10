import { createContext, useState, useEffect, useMemo } from 'react'
import { useNavigate, Outlet } from 'react-router'
import { trackLogin } from '../lib/analytics'
import { apiFetch } from '../lib/apiFetch'

// Chaves de sessão no localStorage (2 tokens JWT + dados do usuário)
const ACCESS_KEY = 'auth_access'
const REFRESH_KEY = 'auth_refresh'
const USER_KEY = 'auth_user'

export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
  creditBalance: number
  phone?: string
  email?: string
  cpf?: string
  birthDate?: string
  condominiumId?: string
  condominiumName?: string
  apartment?: string
  block?: string
  condominiumJustChanged?: boolean
  // false = conta ainda sem senha (1º acesso via OTP) — força tela de definir senha.
  hasPassword?: boolean
}

export interface AuthContextType {
  user: AuthUser | null
  /** access token (JWT curto). Use apiFetch para requisições — ele cuida do refresh. */
  token: string | null
  isLoading: boolean
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void
  logout: () => void
  updateCreditBalance: (balance: number) => void
  updateUser: (partial: Partial<AuthUser>) => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Rehydrate session from localStorage on mount
  // ALL localStorage calls are wrapped in try/catch — iOS Safari private mode can throw
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(ACCESS_KEY)
      const storedUser = localStorage.getItem(USER_KEY)
      if (storedToken && storedUser) {
        setToken(storedToken)
        const parsed = JSON.parse(storedUser) as AuthUser
        // backward compat: older sessions may not have creditBalance
        setUser({ ...parsed, creditBalance: parsed.creditBalance ?? 0 })
      }
    } catch {
      // localStorage unavailable (iOS Safari private mode) — user stays unauthenticated
    }
    setIsLoading(false)
  }, [])

  // Sessão expirada de forma irreversível (refresh falhou no apiFetch): limpa o
  // estado em memória e volta para a splash. O apiFetch já limpou o localStorage.
  useEffect(() => {
    const handler = () => {
      setToken(null)
      setUser(null)
      navigate('/')
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login: (accessToken: string, refreshToken: string, u: AuthUser) => {
        // ensure creditBalance is always present (backward compat with callers that may omit it)
        const userData: AuthUser = { ...u, creditBalance: u.creditBalance ?? 0 }
        try {
          localStorage.setItem(ACCESS_KEY, accessToken)
          localStorage.setItem(REFRESH_KEY, refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(userData))
        } catch {
          // localStorage unavailable — in-memory only; user re-authenticates on refresh
        }
        setToken(accessToken)
        setUser(userData)
        // Métrica de login (Relatórios) — chokepoint único de todos os logins.
        // O backend filtra role=CLIENT para a conversão acesso→login.
        trackLogin(userData.role, userData.id)
      },
      logout: () => {
        // Revoga a sessão (refresh) no servidor — best-effort, não bloqueia o logout.
        void apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
        try {
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
          localStorage.removeItem(USER_KEY)
        } catch {
          // localStorage unavailable — clear in-memory state only
        }
        setToken(null)
        setUser(null)
        navigate('/')
      },
      updateCreditBalance: (balance: number) => {
        setUser((prev) => {
          if (!prev) return prev
          // idempotente: se o saldo não mudou, mantém a mesma referência
          // para não disparar re-renders/efeitos desnecessários
          if (prev.creditBalance === balance) return prev
          const updated: AuthUser = { ...prev, creditBalance: balance }
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(updated))
          } catch {
            // localStorage unavailable — update in-memory only
          }
          return updated
        })
      },
      updateUser: (partial: Partial<AuthUser>) => {
        setUser((prev) => {
          if (!prev) return prev
          // idempotente: se nenhum campo de fato mudou, mantém a referência
          const changed = (Object.keys(partial) as (keyof AuthUser)[]).some(
            (k) => prev[k] !== partial[k],
          )
          if (!changed) return prev
          const updated: AuthUser = { ...prev, ...partial }
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(updated))
          } catch {
            // localStorage unavailable — update in-memory only
          }
          return updated
        })
      },
    }),
    [user, token, isLoading, navigate],
  )

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}
