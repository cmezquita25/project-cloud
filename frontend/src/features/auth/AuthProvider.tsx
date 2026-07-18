import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { session, setOnSessionExpired } from '@shared/api'
import { authApi } from './services/authApi'
import type { LoginCredentials, User } from './types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: User | null
  status: AuthStatus
  isAdmin: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  /** Actualiza el usuario en memoria (p.ej. tras cambiar cuota o perfil). */
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  // Rehidrata la sesión al arrancar (si hay refresh token guardado).
  useEffect(() => {
    let active = true
    if (!session.hasSession()) {
      setStatus('unauthenticated')
      return
    }
    authApi
      .restore()
      .then((u) => {
        if (!active) return
        setUserState(u)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        session.clear()
        setStatus('unauthenticated')
      })
    return () => {
      active = false
    }
  }, [])

  // Si una petición en segundo plano detecta sesión expirada, cerramos.
  useEffect(() => {
    setOnSessionExpired(() => {
      setUserState(null)
      setStatus('unauthenticated')
    })
    return () => setOnSessionExpired(null)
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const u = await authApi.login(credentials)
    setUserState(u)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUserState(null)
    setStatus('unauthenticated')
  }, [])

  const setUser = useCallback((u: User) => setUserState(u), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      setUser,
    }),
    [user, status, login, logout, setUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
