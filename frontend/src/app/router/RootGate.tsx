import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Spinner } from '@shared/ui'
import { installApi } from '@features/install/services/installApi'

/**
 * Portero de arranque: consulta el estado de instalación una vez y redirige.
 *  - No instalado  -> fuerza /install
 *  - Instalado y en /install -> manda a /login
 *  - Si el backend no responde (dev sin API), deja pasar para no bloquear.
 */
export function RootGate() {
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const controller = new AbortController()
    installApi
      .status(controller.signal)
      .then((status) => {
        if (!status.installed && location.pathname !== '/install') {
          navigate('/install', { replace: true })
        } else if (status.installed && location.pathname === '/install') {
          navigate('/login', { replace: true })
        }
      })
      .catch(() => {
        // Backend no disponible: no bloqueamos el desarrollo del front.
      })
      .finally(() => setReady(true))
    return () => controller.abort()
    // Solo en el arranque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas text-content-tertiary">
        <Spinner size={32} />
      </div>
    )
  }

  return <Outlet />
}
