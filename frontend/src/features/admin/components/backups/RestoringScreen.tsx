import { useEffect, useState } from 'react'
import { CheckCircle2, CircleDashed, Loader2, XCircle, AlertTriangle, History, LogIn } from 'lucide-react'
import { maintenance, session } from '@shared/api'
import { AppBackdrop, Button, Portal, ProgressBar } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { databaseApi, type RestoreJob } from '../../services/databaseApi'

const POLL_MS = 1500

/**
 * Pantalla completa mientras se restaura una copia. Consulta el avance con el
 * token de la restauración (no con la sesión: al restaurar la base de datos,
 * las sesiones pasan a ser las de la copia y todas se cierran).
 */
export function RestoringScreen({ job: initial, token, bypass }: { job: RestoreJob; token: string; bypass: string }) {
  const [job, setJob] = useState<RestoreJob>(initial)
  const [lost, setLost] = useState(0)

  useEffect(() => {
    if (job.status !== 'running') return
    const id = window.setInterval(async () => {
      const next = await databaseApi.restoreProgress(token, bypass).catch(() => null)
      if (next) {
        setLost(0)
        setJob(next)
      } else {
        setLost((n) => n + 1)
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [job.status, token, bypass])

  // Al terminar, las sesiones se cerraron: también la de este admin.
  const goToLogin = () => {
    session.clear()
    maintenance.setBypass(null)
    try {
      sessionStorage.clear()
    } catch {
      /* sin almacenamiento */
    }
    window.location.href = '/login'
  }

  const current = job.phases.findIndex((p) => p.key === job.phase)
  const done = job.status === 'completed'
  const failed = job.status !== 'running' && !done

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-canvas p-4">
        <AppBackdrop animated />
        <div className="glass-strong relative z-10 w-full max-w-lg rounded-2xl p-6 ring-1 ring-slate-900/5 sm:p-8 dark:ring-white/10" role="status" aria-live="polite">
          <div className="mb-5 flex items-center gap-3">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', done ? 'bg-success/10 text-success' : failed ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>
              {done ? <CheckCircle2 size={24} /> : failed ? <AlertTriangle size={24} /> : <History size={24} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-content-primary">
                {job.status === 'running' && 'Restaurando la plataforma'}
                {done && 'Restauración completada'}
                {job.status === 'rolled_back' && 'La restauración no se aplicó'}
                {job.status === 'failed' && 'La restauración terminó con errores'}
                {job.status === 'error' && 'La restauración necesita atención'}
              </h2>
              <p className="text-sm text-content-secondary">
                {job.status === 'running' && 'No cierres esta ventana. La plataforma está en mantenimiento.'}
                {done && 'Todos los usuarios, incluido tú, deben volver a iniciar sesión.'}
                {job.status === 'rolled_back' && 'Se volvió a cargar la base de datos que había antes. La plataforma quedó como estaba.'}
                {job.status === 'failed' && 'La base de datos se restauró, pero algunos archivos no. Revisa el registro.'}
                {job.status === 'error' && 'La base de datos pudo quedar incompleta. El modo mantenimiento sigue activo.'}
              </p>
            </div>
          </div>

          <ProgressBar value={job.progress} />
          <p className="mt-1.5 text-right font-mono text-xs text-content-tertiary">{job.progress}%</p>

          <ol className="mt-4 space-y-2">
            {job.phases.map((p, i) => {
              const state = done || i < current ? 'done' : i === current ? (failed ? 'failed' : 'current') : 'pending'
              return (
                <li key={p.key} className="flex items-center gap-2.5 text-sm">
                  {state === 'done' && <CheckCircle2 size={16} className="shrink-0 text-success" />}
                  {state === 'current' && <Loader2 size={16} className="shrink-0 animate-spin text-primary" />}
                  {state === 'failed' && <XCircle size={16} className="shrink-0 text-red-500" />}
                  {state === 'pending' && <CircleDashed size={16} className="shrink-0 text-content-tertiary" />}
                  <span className={cn(state === 'pending' ? 'text-content-tertiary' : 'text-content-primary', state === 'current' && 'font-medium')}>
                    {p.label}
                    {p.key === 'files' && state === 'current' && job.files_total > 0 && ` (${job.files.toLocaleString()} de ${job.files_total.toLocaleString()})`}
                  </span>
                </li>
              )
            })}
          </ol>

          {lost > 3 && job.status === 'running' && <p className="mt-4 text-xs text-amber-500">Sin respuesta del servidor. Reintentando…</p>}

          {done && job.quarantined > 0 && (
            <p className="mt-4 rounded-xl border border-border p-3 text-xs text-content-secondary">
              {job.quarantined === 1 ? '1 archivo subido' : `${job.quarantined} archivos subidos`} después de la copia {job.quarantined === 1 ? 'quedó' : 'quedaron'} en <code className="font-mono">{job.quarantine_dir}</code>.
            </p>
          )}
          {job.error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">{job.error}</div>}
          {job.status === 'error' && (
            <p className="mt-3 text-xs text-content-secondary">
              Vuelve a restaurar esta copia o la copia «pre-restore» {job.safety_file && <code className="font-mono">({job.safety_file})</code>} desde
              Base de datos.
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

          {job.status !== 'running' && (
            <div className="mt-6 flex justify-end">
              {job.status === 'error' ? (
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Volver a Base de datos
                </Button>
              ) : (
                <Button leftIcon={LogIn} onClick={goToLogin}>
                  Iniciar sesión de nuevo
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
