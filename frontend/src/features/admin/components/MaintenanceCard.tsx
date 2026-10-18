import { useEffect, useState } from 'react'
import { ShieldAlert, Power } from 'lucide-react'
import { api, maintenance, session, type MaintenanceStatus } from '@shared/api'
import { Button, Checkbox, Dialog, Input, Select, useToast } from '@shared/ui'

interface EnableResponse {
  maintenance: MaintenanceStatus
  bypass_token: string
  session: { access_token: string; refresh_token: string } | null
}

const DURATIONS = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 240, label: '4 horas' },
  { value: 0, label: 'Hasta desactivarlo' },
]

/**
 * Activa o desactiva el modo mantenimiento a mano. Mientras está activo, solo
 * el admin que lo activó puede usar la plataforma (con su token de paso); el
 * resto ve la pantalla de mantenimiento. Las URLs públicas de /storage siguen
 * funcionando.
 */
export function MaintenanceCard() {
  const toast = useToast()
  const [status, setStatus] = useState<MaintenanceStatus>(maintenance.get())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [duration, setDuration] = useState(60)
  const [message, setMessage] = useState('')
  const [logoutAll, setLogoutAll] = useState(false)

  useEffect(() => maintenance.subscribe(setStatus), [])

  const enable = async () => {
    setBusy(true)
    try {
      const data = await api.post<EnableResponse>('/admin/maintenance', {
        active: true,
        duration_minutes: duration,
        message: message.trim() || undefined,
        logout_all: logoutAll,
      })
      maintenance.setBypass(data.bypass_token)
      if (data.session) session.set(data.session.access_token, data.session.refresh_token)
      maintenance.set(data.maintenance)
      setOpen(false)
      toast.success(logoutAll ? 'Mantenimiento activado y sesiones cerradas' : 'Mantenimiento activado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo activar el modo mantenimiento')
    } finally {
      setBusy(false)
    }
  }

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
    <div className="space-y-4 rounded-drive glass p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-medium text-content-primary">
            <ShieldAlert size={18} className="text-amber-500" /> Modo mantenimiento
          </h3>
          <p className="text-xs text-content-secondary">
            Bloquea temporalmente el acceso a la plataforma. Los usuarios verán un aviso y la página se recargará sola al terminar.
            Las URLs públicas de los archivos siguen funcionando.
          </p>
        </div>
        {status.active ? (
          <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500">Activo</span>
        ) : (
          <span className="shrink-0 rounded-full border border-border bg-content-tertiary/10 px-2.5 py-0.5 text-xs font-medium text-content-tertiary">Inactivo</span>
        )}
      </div>

      <div className="flex justify-end">
        {status.active ? (
          <Button variant="secondary" leftIcon={Power} loading={busy} onClick={disable}>
            Desactivar mantenimiento
          </Button>
        ) : (
          <Button variant="secondary" leftIcon={ShieldAlert} onClick={() => setOpen(true)}>
            Activar mantenimiento
          </Button>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Activar modo mantenimiento"
        description="Solo tú podrás seguir usando la plataforma desde este navegador."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={enable} loading={busy}>
              Activar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-content-secondary">Duración</span>
            <Select value={duration} onChange={(v) => setDuration(Number(v))} options={DURATIONS} />
            <p className="text-xs text-content-tertiary">Al terminar el tiempo, la plataforma se reactiva sola.</p>
          </div>

          <Input
            label="Mensaje para los usuarios (opcional)"
            placeholder="Ej. Estamos migrando el servidor, volvemos a las 22:00."
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <Checkbox checked={logoutAll} onChange={(e) => setLogoutAll(e.target.checked)} />
            <span className="text-sm text-content-secondary">
              <span className="block font-medium text-content-primary">Cerrar la sesión de todos los usuarios</span>
              Todos tendrán que volver a iniciar sesión al terminar. Tu sesión se renueva automáticamente.
            </span>
          </label>

          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-content-secondary">
            Si pierdes el acceso (por ejemplo, borras los datos del navegador), elimina el archivo{' '}
            <code className="font-mono">api/config/maintenance.json</code> desde el administrador de archivos del hosting.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
