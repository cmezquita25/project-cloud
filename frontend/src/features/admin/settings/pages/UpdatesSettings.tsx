import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Undo2,
  Trash2,
  Sparkles,
  Bug,
  ShieldCheck,
  PackageCheck,
} from 'lucide-react'
import { Button, Dialog, Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes } from '@shared/lib/formatBytes'
import { reloadWithFreshCache } from '@shared/hooks/usePlatformSettings'
import { updatesApi, type ChangelogEntry, type UpdateJob } from '../../services/updatesApi'
import { UPDATE_BADGE_KEY } from '../../hooks/useUpdateBadge'
import { PreUpdateDialog } from '../../components/updates/PreUpdateDialog'
import { UpdatingScreen } from '../../components/updates/UpdatingScreen'

const STATUS_KEY = ['admin', 'updates'] as const

const CHANGE_TYPE: Record<string, { label: string; icon: typeof Sparkles; className: string }> = {
  feature: { label: 'Nuevo', icon: Sparkles, className: 'bg-primary/10 text-primary' },
  fix: { label: 'Corrección', icon: Bug, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  security: { label: 'Seguridad', icon: ShieldCheck, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
}

const HISTORY_STATUS: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completada', className: 'text-success' },
  rolled_back: { label: 'Revertida automáticamente', className: 'text-amber-500' },
  failed: { label: 'No aplicada', className: 'text-red-500' },
  cancelled: { label: 'Cancelada', className: 'text-content-tertiary' },
  error: { label: 'Requiere atención', className: 'text-red-500' },
}

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

export function UpdatesSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [checking, setChecking] = useState(false)
  const [preOpen, setPreOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [activeJob, setActiveJob] = useState<UpdateJob | null>(null)
  const [confirm, setConfirm] = useState<'revert' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)

  // Siempre datos frescos: tras actualizar o revertir, la versión instalada cambia.
  const { data, isLoading } = useQuery({ queryKey: STATUS_KEY, queryFn: updatesApi.status, staleTime: 0, refetchOnMount: 'always' })

  // El aviso del sidebar sigue siempre a los datos frescos de esta página.
  useEffect(() => {
    if (!data) return
    queryClient.setQueryData(UPDATE_BADGE_KEY, {
      available_version: data.available?.version ?? null,
      running: data.job?.status === 'running',
    })
  }, [data, queryClient])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: STATUS_KEY })
    queryClient.invalidateQueries({ queryKey: UPDATE_BADGE_KEY })
  }

  const check = async () => {
    setChecking(true)
    try {
      const status = await updatesApi.check()
      queryClient.setQueryData(STATUS_KEY, status)
      queryClient.invalidateQueries({ queryKey: UPDATE_BADGE_KEY })
      toast.success(status.available ? `Hay una versión nueva: v${status.available.version}` : 'Tu plataforma está al día')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo consultar el servidor de actualizaciones')
    } finally {
      setChecking(false)
    }
  }

  const start = async (backup: 'system' | 'none') => {
    if (!data?.available) return
    setStarting(true)
    try {
      const res = await updatesApi.start(data.available.version, backup)
      setPreOpen(false)
      setActiveJob(res.job)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar la actualización')
      refresh()
    } finally {
      setStarting(false)
    }
  }

  const runConfirm = async () => {
    setBusy(true)
    try {
      if (confirm === 'revert') {
        const res = await updatesApi.revert()
        toast.success(`Plataforma revertida a v${res.reverted_to}. Recargando…`)
        window.setTimeout(reloadWithFreshCache, 1200)
      } else {
        await updatesApi.deleteOldFiles()
        toast.success('Respaldo de la versión anterior eliminado')
        refresh()
      }
      setConfirm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar la acción')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={28} />
      </div>
    )
  }

  // Un trabajo en curso (p. ej. tras cerrar la pestaña) se retoma al entrar.
  const runningJob = activeJob ?? (data.job?.status === 'running' ? data.job : null)
  const lastFailed = data.job && ['failed', 'rolled_back', 'error'].includes(data.job.status) ? data.job : null
  const blocking = data.preflight?.filter((c) => c.critical && !c.ok) ?? []

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DownloadCloud size={22} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-content-primary">Actualizaciones</h2>
            <p className="text-sm text-content-secondary">Instala versiones nuevas de la plataforma de forma segura.</p>
          </div>
        </div>
        <Button variant="secondary" leftIcon={RefreshCw} loading={checking} onClick={check} className="shrink-0 whitespace-nowrap">
          Buscar actualizaciones
        </Button>
      </div>

      {/* Versión instalada */}
      <section className="glass flex flex-col gap-3 rounded-drive p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-content-tertiary">Versión instalada</p>
          <p className="text-2xl font-semibold text-content-primary">v{data.current.version}</p>
          <p className="text-xs text-content-tertiary">Base de datos: schema {data.current.schema}</p>
        </div>
        <div className="text-left text-xs text-content-secondary sm:text-right">
          <p>Última verificación: {formatDate(data.last_check)}</p>
          {data.last_error && <p className="mt-1 max-w-sm text-red-500">{data.last_error}</p>}
        </div>
      </section>

      {lastFailed && <LastJobAlert job={lastFailed} />}

      {/* Disponible / al día */}
      {data.available ? (
        <section className="glass space-y-5 rounded-drive p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Nueva versión</span>
              <h3 className="mt-2 text-lg font-semibold text-content-primary">v{data.available.version}</h3>
              <p className="text-xs text-content-tertiary">
                {data.available.released_at && `Publicada el ${new Date(data.available.released_at + 'T12:00:00').toLocaleDateString()} · `}
                {formatBytes(data.available.size_bytes)}
              </p>
            </div>
            <Button leftIcon={DownloadCloud} disabled={blocking.length > 0} onClick={() => setPreOpen(true)}>
              Actualizar ahora
            </Button>
          </div>

          <Changelog entries={data.available.changelog} />

          {!data.available.reversible && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-content-secondary">
              Esta versión hace cambios irreversibles en la base de datos: la copia previa es obligatoria y después no se podrá usar
              «Revertir» (habría que restaurar la copia).
            </p>
          )}

          {data.preflight && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-secondary">Requisitos</h4>
              <ul className="space-y-1.5">
                {data.preflight.map((c) => (
                  <li key={c.key} className="flex items-start gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                    ) : c.critical ? (
                      <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                    ) : (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    )}
                    <span>
                      <span className="text-content-primary">{c.label}</span>
                      <span className="block text-xs text-content-tertiary">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="glass flex items-center gap-3 rounded-drive p-5">
          <PackageCheck size={22} className="shrink-0 text-success" />
          <div>
            <p className="font-medium text-content-primary">Tu plataforma está al día</p>
            <p className="text-xs text-content-secondary">Se busca automáticamente cada 12 horas.</p>
          </div>
        </section>
      )}

      {/* Respaldo de la versión anterior (solo si existe old-files) */}
      {data.old_files && (
        <section className="glass space-y-3 rounded-drive p-5">
          <div>
            <h3 className="text-base font-medium text-content-primary">Respaldo de la versión anterior</h3>
            <p className="text-xs text-content-secondary">
              Archivos de v{data.old_files.from_version} guardados al actualizar a v{data.old_files.to_version} el{' '}
              {formatDate(data.old_files.created_at)} · {formatBytes(data.old_files.size_bytes)}.
            </p>
          </div>
          {!data.old_files.reversible && (
            <p className="text-xs text-amber-500">
              Esa actualización cambió la base de datos de forma irreversible: para volver atrás, restaura la copia previa.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {data.old_files.can_revert && (
              <Button variant="secondary" leftIcon={Undo2} onClick={() => setConfirm('revert')}>
                Revertir a v{data.old_files.from_version}
              </Button>
            )}
            <Button variant="ghost" leftIcon={Trash2} onClick={() => setConfirm('delete')}>
              Eliminar respaldo de la versión anterior
            </Button>
          </div>
        </section>
      )}

      {/* Historial */}
      {data.history.length > 0 && (
        <section className="glass rounded-drive p-5">
          <h3 className="mb-3 flex items-center gap-2 text-base font-medium text-content-primary">
            <History size={18} /> Historial
          </h3>
          <ul className="divide-y divide-border">
            {data.history.map((h) => {
              const st = HISTORY_STATUS[h.status] ?? { label: h.status, className: '' }
              return (
                <li key={h.id} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-content-primary">
                    {h.type === 'revert' ? 'Reversión' : 'Actualización'} v{h.from_version} → v{h.to_version}
                  </span>
                  <span className="text-xs text-content-tertiary">
                    {formatDate(h.finished_at ?? h.started_at)} · <span className={st.className}>{st.label}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {data.available && (
        <PreUpdateDialog
          open={preOpen}
          onClose={() => setPreOpen(false)}
          currentVersion={data.current.version}
          update={data.available}
          lastBackup={data.last_backup}
          starting={starting}
          onConfirm={start}
        />
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => !busy && setConfirm(null)}
        title={confirm === 'revert' ? `¿Revertir a v${data.old_files?.from_version}?` : '¿Eliminar el respaldo de la versión anterior?'}
        description={
          confirm === 'revert'
            ? 'Se restaurarán los archivos de la versión anterior. La plataforma estará en mantenimiento unos segundos. La base de datos no cambia.'
            : 'Ya no podrás revertir a la versión anterior desde aquí. Las copias de seguridad no se ven afectadas.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant={confirm === 'delete' ? 'danger' : 'primary'} loading={busy} onClick={runConfirm}>
              {confirm === 'revert' ? 'Revertir' : 'Eliminar'}
            </Button>
          </>
        }
      />

      {runningJob && (
        <UpdatingScreen
          job={runningJob}
          onClose={() => {
            setActiveJob(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function Changelog({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <ul className="space-y-2">
      {entries.map((e, i) => {
        const type = CHANGE_TYPE[e.type] ?? { label: 'Cambio', icon: Sparkles, className: 'bg-content-tertiary/10 text-content-secondary' }
        return (
          <li key={i} className="flex items-start gap-2.5 text-sm text-content-secondary">
            <span className={cn('mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', type.className)}>
              <type.icon size={11} /> {type.label}
            </span>
            <span>{e.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

function LastJobAlert({ job }: { job: UpdateJob }) {
  const rolledBack = job.status === 'rolled_back'
  return (
    <section className={cn('rounded-drive border p-4 text-sm', rolledBack ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5')}>
      <p className="font-medium text-content-primary">
        {rolledBack
          ? `La actualización a v${job.to_version} falló y se revirtió automáticamente`
          : `La actualización a v${job.to_version} no se aplicó`}
      </p>
      {job.error && <p className="mt-1 text-xs text-content-secondary">{job.error}</p>}
      <p className="mt-1 text-xs text-content-tertiary">{formatDate(job.finished_at)} · La plataforma sigue en v{job.from_version}.</p>
    </section>
  )
}
