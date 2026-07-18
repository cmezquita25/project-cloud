import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@shared/ui'
import { useAuth } from '@features/auth/AuthProvider'

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas text-content-tertiary">
      <Spinner size={32} />
    </div>
  )
}

/** Exige sesión iniciada. Redirige a /login conservando el destino. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Exige rol admin (debe ir dentro de RequireAuth). */
export function RequireAdmin() {
  const { isAdmin, status } = useAuth()
  if (status === 'loading') return <FullScreenSpinner />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

/** Para /login: si ya hay sesión, manda a la app. */
export function RedirectIfAuth() {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
