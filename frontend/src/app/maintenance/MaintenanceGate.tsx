import { useEffect, useState, type ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api, maintenance, type MaintenanceStatus } from '@shared/api'
import { Button, useToast } from '@shared/ui'
import { reloadWithFreshCache } from '@shared/hooks/usePlatformSettings'
import { MaintenanceScreen } from './MaintenanceScreen'

/** Cada cuánto se vuelve a consultar el estado mientras dura el mantenimiento. */
const POLL_MS = 30_000

/**
 * Portero del modo mantenimiento.
 *
 * - Al arrancar consulta `/system/status`; además, cualquier `503 MAINTENANCE`
 *   del cliente HTTP lo activa al instante.
 * - Sin token de paso: sustituye la app por la pantalla de mantenimiento y
 *   recarga sola cuando termina (así nadie se queda con la versión anterior).
 * - Con token de paso (el admin que lo activó): deja usar la app y muestra una
 *   franja superior para desactivarlo.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MaintenanceStatus>(maintenance.get())

  useEffect(() => maintenance.subscribe(setStatus), [])

  useEffect(() => {
    maintenance
      .fetchStatus()
      .then((s) => {
        if (!s.active) {
          maintenance.setBypass(null) // token de un mantenimiento que ya terminó
          return
        }
        maintenance.set(s)
      })
      .catch(() => {
        // API no disponible: no bloqueamos (RootGate y las vistas lo gestionan).
      })
  }, [])

  useEffect(() => {
    if (!status.active) return
    const id = window.setInterval(() => {
      maintenance
        .fetchStatus()
        .then((s) => {
          if (s.active) {
            maintenance.set(s)
            return
          }
          maintenance.setBypass(null)
          reloadWithFreshCache()
        })
        .catch(() => {})
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [status.active])

  if (!status.active) return <>{children}</>

  if (!maintenance.getBypass()) return <MaintenanceScreen status={status} />

  return (
    <>
      <AdminMaintenanceBanner />
      {children}
    </>
  )
}

/** Aviso flotante visible solo para el admin con token de paso. */
function AdminMaintenanceBanner() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const disable = async () => {
    setBusy(true)
    try {
      await api.post('/admin/maintenance', { active: false })
      maintenance.setBypass(null)
      maintenance.markInactive()
      toast.success('La plataforma vuelve a estar disponible para todos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desactivar el modo mantenimiento')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-amber-500/30 bg-amber-50/90 py-1.5 pl-4 pr-1.5 text-xs text-amber-700 shadow-lg backdrop-blur-md dark:bg-amber-950/80 dark:text-amber-300">
      <ShieldAlert size={14} className="shrink-0" />
      <span className="min-w-0 truncate">
        <strong className="font-semibold">Modo mantenimiento activo.</strong>{' '}
        <span className="hidden sm:inline">Solo tú puedes usar la plataforma.</span>
      </span>
      <Button size="sm" variant="secondary" loading={busy} onClick={disable}>
        Desactivar
      </Button>
    </div>
  )
}
