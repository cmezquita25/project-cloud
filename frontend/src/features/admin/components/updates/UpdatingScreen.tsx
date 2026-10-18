import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleDashed, Loader2, XCircle, AlertTriangle, RotateCcw, DownloadCloud } from 'lucide-react'
import { ApiError, maintenance, session } from '@shared/api'
import { AppBackdrop, Button, Portal, ProgressBar } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { reloadWithFreshCache } from '@shared/hooks/usePlatformSettings'
import { updatesApi, type UpdateJob } from '../../services/updatesApi'

/** Pausa entre pasos y espera ante errores de red (ms). */
const STEP_DELAY = 250
const RETRY_DELAY = 3000
const MAX_NETWORK_RETRIES = 20

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

interface Props {
  job: UpdateJob
  /** Se llama al cerrar la pantalla tras un fallo o cancelación. */
  onClose: () => void
}

/**
 * Pantalla completa mientras se aplica una actualización. Pide los pasos al
 * servidor uno a uno (cada paso es una petición corta) hasta terminar. Si la
 * pestaña se cierra, el proceso se retoma al volver a Configuración →
 * Actualizaciones.
 */
export function UpdatingScreen({ job: initial, onClose }: Props) {
  const [job, setJob] = useState<UpdateJob>(initial)
  const [retrying, setRetrying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const running = useRef(false)

  useEffect(() => {
    if (running.current || initial.status !== 'running') return
    running.current = true
    let alive = true

    const loop = async () => {
      let failures = 0
      while (alive) {
        try {
          const res = await updatesApi.step()
          failures = 0
          setRetrying(false)
          // El paso que activa el mantenimiento cierra todas las sesiones y
          // entrega un token de paso y una sesión nueva para este admin.
          if (res.maintenance_bypass) maintenance.setBypass(res.maintenance_bypass)
          if (res.session) session.set(res.session.access_token, res.session.refresh_token)
          setJob(res.job)
          if (res.job.status !== 'running') {
            if (res.job.status !== 'error') maintenance.setBypass(null)
            break
          }
          await sleep(STEP_DELAY)
        } catch (err) {
          // Errores de red o del proxy: el estado vive en el servidor, se reintenta.
          if (err instanceof ApiError && err.status > 0 && err.status < 500 && err.code !== 'MAINTENANCE') {
            setJob((j) => ({ ...j, status: 'failed', error: err.message }))
            break
          }
          failures++
          setRetrying(true)
          if (failures > MAX_NETWORK_RETRIES) {
            setJob((j) => ({ ...j, status: 'error', error: 'Se perdió la conexión con el servidor. Recarga la página para retomar la actualización.' }))
            break
          }
          await sleep(RETRY_DELAY)
        }
      }
    }
    void loop()
    return () => {
      alive = false
    }
  }, [initial.status])

  const cancel = async () => {
    setCancelling(true)
    try {
      const res = await updatesApi.cancel()
      setJob(res.job)
    } catch (err) {
      setJob((j) => ({ ...j, error: err instanceof Error ? err.message : 'No se pudo cancelar' }))
    } finally {
      setCancelling(false)
    }
  }

  const currentIndex = job.steps.findIndex((s) => s.key === job.step)
  const done = job.status === 'completed'
  const failed = job.status !== 'running' && !done

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-canvas p-4">
        <AppBackdrop animated />
        <div className="glass-strong relative z-10 w-full max-w-lg rounded-2xl p-6 ring-1 ring-slate-900/5 sm:p-8 dark:ring-white/10" role="status" aria-live="polite">
          <div className="mb-5 flex items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                done ? 'bg-success/10 text-success' : failed ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
              )}
            >
              {done ? <CheckCircle2 size={24} /> : failed ? <AlertTriangle size={24} /> : <DownloadCloud size={24} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-content-primary">
                {done && `Plataforma actualizada a v${job.to_version}`}
                {job.status === 'running' && `Actualizando a v${job.to_version}`}
                {job.status === 'rolled_back' && 'La actualización se revirtió'}
                {job.status === 'failed' && 'La actualización no se aplicó'}
                {job.status === 'cancelled' && 'Actualización cancelada'}
                {job.status === 'error' && 'La actualización necesita atención'}
              </h2>
              <p className="text-sm text-content-secondary">
                {job.status === 'running' && 'No cierres esta ventana. Si se cierra, el proceso continuará al volver.'}
                {done && 'Todo terminó correctamente. Recarga para usar la versión nueva.'}
                {job.status === 'rolled_back' && `Se restauraron los archivos de v${job.from_version}. La plataforma sigue funcionando.`}
                {job.status === 'failed' && 'No se modificó ningún archivo de la plataforma.'}
                {job.status === 'cancelled' && 'No se modificó nada.'}
                {job.status === 'error' && 'La reversión automática no pudo completarse. El modo mantenimiento sigue activo.'}
              </p>
            </div>
          </div>

          <ProgressBar value={job.progress} />
          <p className="mt-1.5 text-right font-mono text-xs text-content-tertiary">{job.progress}%</p>

          <ol className="mt-4 space-y-2">
            {job.steps.map((s, i) => {
              const state = done || i < currentIndex ? 'done' : i === currentIndex ? (failed ? 'failed' : 'current') : 'pending'
              return (
                <li key={s.key} className="flex items-center gap-2.5 text-sm">
                  {state === 'done' && <CheckCircle2 size={16} className="shrink-0 text-success" />}
                  {state === 'current' && <Loader2 size={16} className="shrink-0 animate-spin text-primary" />}
                  {state === 'failed' && <XCircle size={16} className="shrink-0 text-red-500" />}
                  {state === 'pending' && <CircleDashed size={16} className="shrink-0 text-content-tertiary" />}
                  <span className={cn(state === 'pending' ? 'text-content-tertiary' : 'text-content-primary', state === 'current' && 'font-medium')}>
                    {s.label}
                  </span>
                </li>
              )
            })}
          </ol>

          {retrying && job.status === 'running' && (
            <p className="mt-4 text-xs text-amber-500">Sin respuesta del servidor. Reintentando…</p>
          )}

          {job.error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">{job.error}</div>
          )}
          {job.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-content-secondary">
              {job.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          {job.status === 'error' && (
            <p className="mt-3 text-xs text-content-secondary">
              Los archivos originales están en <code className="font-mono">api/var/old-files/files</code>. Copia su contenido sobre la
              raíz del sitio desde el administrador de archivos y después borra <code className="font-mono">api/config/maintenance.json</code>.
            </p>
          )}

          {failed && job.log.length > 0 && (
            <details className="mt-3 text-xs text-content-secondary">
              <summary className="cursor-pointer">Ver registro</summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono">
                {job.log.map((l, i) => (
                  <li key={i} className={cn(l.level === 'error' && 'text-red-500', l.level === 'warning' && 'text-amber-500')}>
                    {new Date(l.at).toLocaleTimeString()} {l.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-6 flex justify-end gap-2">
            {job.status === 'running' && job.cancellable && (
              <Button variant="ghost" loading={cancelling} onClick={cancel}>
                Cancelar
              </Button>
            )}
            {done && (
              <Button leftIcon={RotateCcw} onClick={reloadWithFreshCache}>
                Recargar la plataforma
              </Button>
            )}
            {failed && (
              <Button variant="secondary" onClick={job.status === 'error' ? reloadWithFreshCache : onClose}>
                {job.status === 'error' ? 'Recargar' : 'Cerrar'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
