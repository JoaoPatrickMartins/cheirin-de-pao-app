import { createContext, useState, useEffect, useMemo } from 'react'
import { useNavigate, Outlet } from 'react-router'

export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
  creditBalance: number
}

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
  updateCreditBalance: (balance: number) => void
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
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')
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

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login: (t: string, u: AuthUser) => {
        // ensure creditBalance is always present (backward compat with callers that may omit it)
        const userData: AuthUser = { ...u, creditBalance: u.creditBalance ?? 0 }
        try {
          localStorage.setItem('auth_token', t)
          localStorage.setItem('auth_user', JSON.stringify(userData))
        } catch {
          // localStorage unavailable — in-memory only; user re-authenticates on refresh
        }
        setToken(t)
        setUser(userData)
      },
      logout: () => {
        try {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
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
          const updated: AuthUser = { ...prev, creditBalance: balance }
          try {
            localStorage.setItem('auth_user', JSON.stringify(updated))
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
