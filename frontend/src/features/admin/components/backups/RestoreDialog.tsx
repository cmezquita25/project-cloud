import { useEffect, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { maintenance } from '@shared/api'
import { Button, Checkbox, Dialog, Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes } from '@shared/lib/formatBytes'
import { databaseApi, type RestoreAnalysis, type RestoreJob, type RestoreOptions } from '../../services/databaseApi'

const LEVEL_ICON = {
  ok: { icon: CheckCircle2, className: 'text-success' },
  info: { icon: Info, className: 'text-primary' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  error: { icon: XCircle, className: 'text-red-500' },
} as const

const STATUS = {
  ok: { icon: ShieldCheck, title: 'Todo en orden', className: 'border-success/30 bg-success/5 text-success' },
  warning: { icon: ShieldAlert, title: 'Revisa las advertencias antes de continuar', className: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400' },
  blocked: { icon: ShieldX, title: 'Esta copia no se puede restaurar', className: 'border-red-500/30 bg-red-500/5 text-red-500' },
} as const

interface Props {
  filename: string | null
  onClose: () => void
  /** Restauración lanzada: la pantalla de progreso toma el relevo. */
  onStarted: (job: RestoreJob, progressToken: string, bypass: string) => void
}

/** Diagnóstico de la copia y confirmación de la restauración. */
export function RestoreDialog({ filename, onClose, onStarted }: Props) {
  const toast = useToast()
  const [analysis, setAnalysis] = useState<RestoreAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<RestoreOptions>({ restore_config: false, quarantine: true, safety_copy: true })
  const [ack, setAck] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!filename) return
    setAnalysis(null)
    setError(null)
    setAck(false)
    databaseApi
      .analyzeBackup(filename)
      .then((a) => {
        setAnalysis(a)
        setOptions(a.defaults)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo analizar la copia'))
  }, [filename])

  const start = async () => {
    if (!filename) return
    setStarting(true)
    try {
      const res = await databaseApi.restoreBackup(filename, options)
      maintenance.setBypass(res.maintenance_bypass)
      onStarted(res.job, res.progress_token, res.maintenance_bypass)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar la restauración')
    } finally {
      setStarting(false)
    }
  }

  const has = (key: string) => analysis?.checks.some((c) => c.key === key && c.level !== 'ok') ?? false
  const blocked = analysis?.status === 'blocked'
  const status = analysis ? STATUS[analysis.status] : null

  return (
    <Dialog
      open={filename !== null}
      onClose={() => !starting && onClose()}
      size="lg"
      title="Restaurar copia de seguridad"
      description={filename ?? undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={starting}>
            {blocked ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!blocked && (
            <Button variant="danger" onClick={start} loading={starting} disabled={!analysis || !ack}>
              Restaurar
            </Button>
          )}
        </>
      }
    >
      {!analysis && !error && (
        <div className="flex items-center gap-3 py-6 text-sm text-content-secondary">
          <Spinner size={20} /> Analizando la copia…
        </div>
      )}
      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">{error}</p>}

      {analysis && status && (
        <div className="space-y-4 text-sm">
          <div className={cn('flex items-center gap-2 rounded-xl border p-3 font-medium', status.className)}>
            <status.icon size={18} /> {status.title}
          </div>

          <p className="text-xs text-content-tertiary">
            Copia del {new Date(analysis.backup.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            {analysis.backup.app_version && ` · v${analysis.backup.app_version}`} · {analysis.backup.scope === 'system' ? 'solo sistema' : 'completa'} ·{' '}
            {formatBytes(analysis.backup.size_bytes)}
          </p>

          <ul className="space-y-2">
            {analysis.checks.map((c) => {
              const lvl = LEVEL_ICON[c.level]
              return (
                <li key={c.key} className="flex items-start gap-2.5">
                  <lvl.icon size={16} className={cn('mt-0.5 shrink-0', lvl.className)} />
                  <span>
                    <span className="font-medium text-content-primary">{c.label}</span>
                    <span className="block text-xs text-content-secondary">{c.detail}</span>
                  </span>
                </li>
              )
            })}
          </ul>

          {!blocked && (
            <div className="space-y-2 border-t border-border pt-4">
              <Option
                checked={options.safety_copy}
                onChange={(v) => setOptions({ ...options, safety_copy: v })}
                title="Crear una copia del estado actual antes de restaurar"
                detail="Recomendado. Si algo falla con la base de datos, se vuelve a cargar automáticamente."
              />
              {has('orphans') && (
                <Option
                  checked={options.quarantine}
                  onChange={(v) => setOptions({ ...options, quarantine: v })}
                  title="Apartar en cuarentena los archivos subidos después de la copia"
                  detail="Se mueven a api/var/restore-orphans para que no queden sueltos sin registro."
                />
              )}
              {has('config') && (
                <Option
                  checked={options.restore_config}
                  onChange={(v) => setOptions({ ...options, restore_config: v })}
                  title="Restaurar también la configuración del servidor"
                  detail="Solo si la copia viene de este mismo servidor y cambiaste la conexión a la base de datos después."
                />
              )}

              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span className="text-content-secondary">
                  Entiendo que <b className="text-content-primary">se reemplazará el estado actual</b> de la plataforma, que estará en
                  mantenimiento durante el proceso y que <b className="text-content-primary">todos tendrán que volver a iniciar sesión</b>.
                </span>
              </label>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

function Option({ checked, onChange, title, detail }: { checked: boolean; onChange: (v: boolean) => void; title: string; detail: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-content-primary">{title}</span>
        <span className="text-xs text-content-secondary">{detail}</span>
      </span>
    </label>
  )
}
