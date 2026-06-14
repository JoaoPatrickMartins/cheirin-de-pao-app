import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import type { AuthContextType } from '../contexts/AuthContext'

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
