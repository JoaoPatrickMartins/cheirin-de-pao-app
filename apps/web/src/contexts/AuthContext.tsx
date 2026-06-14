import { createContext, useState, useEffect, useMemo } from 'react'
import { useNavigate, Outlet } from 'react-router'

export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
}

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
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
        setUser(JSON.parse(storedUser) as AuthUser)
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
        try {
          localStorage.setItem('auth_token', t)
          localStorage.setItem('auth_user', JSON.stringify(u))
        } catch {
          // localStorage unavailable — in-memory only; user re-authenticates on refresh
        }
        setToken(t)
        setUser(u)
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
    }),
    [user, token, isLoading, navigate],
  )

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}
