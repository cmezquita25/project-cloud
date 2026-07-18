import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Loader2,
} from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { formatBytes } from '@shared/lib/formatBytes'
import { getFileIcon } from '@shared/lib/fileIcons'
import { IconButton } from '@shared/ui'
import { useUploads, type UploadTask } from '../UploadProvider'

function TaskRow({ task, onCancel, onRetry }: { task: UploadTask; onCancel: () => void; onRetry: () => void }) {
  const { icon: Icon, className } = getFileIcon(task.name)
  const pct = task.size > 0 ? Math.round((task.loaded / task.size) * 100) : 100

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Icon size={20} className={cn('shrink-0', className)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content-primary">{task.name}</p>
        {task.status === 'uploading' && (
          <div className="mt-1 h-1 overflow-hidden rounded-pill bg-surface-hover">
            <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
        {task.status === 'error' && <p className="truncate text-xs text-danger">{task.error}</p>}
        {task.status === 'queued' && <p className="text-xs text-content-tertiary">En cola…</p>}
        {task.status === 'canceled' && <p className="text-xs text-content-tertiary">Cancelado</p>}
      </div>
      <div className="shrink-0">
        {task.status === 'done' && <CheckCircle2 size={20} className="text-success" />}
        {task.status === 'uploading' && (
          <button onClick={onCancel} className="text-content-tertiary hover:text-danger" aria-label="Cancelar">
            <Loader2 size={18} className="animate-spin" />
          </button>
        )}
        {task.status === 'error' && (
          <IconButton icon={RotateCw} label="Reintentar" size="sm" onClick={onRetry} />
        )}
        {(task.status === 'queued' || task.status === 'canceled') && (
          <IconButton icon={X} label="Quitar" size="sm" onClick={onCancel} />
        )}
      </div>
    </div>
  )
}

/** Tarjeta flotante de progreso de subidas (esquina inferior derecha). */
export function UploadDock() {
  const { tasks, cancel, retry, clearFinished, dismissAll } = useUploads()
  const [minimized, setMinimized] = useState(false)

  if (tasks.length === 0) return null

  const active = tasks.filter((t) => t.status === 'uploading' || t.status === 'queued').length
  const done = tasks.filter((t) => t.status === 'done').length
  const errors = tasks.filter((t) => t.status === 'error').length

  const title =
    active > 0
      ? `Subiendo ${active} elemento${active > 1 ? 's' : ''}`
      : errors > 0
        ? `${done} completado(s), ${errors} con error`
        : `${done} completado${done > 1 ? 's' : ''}`

  return (
    <div className="fixed inset-x-0 bottom-0 z-toast flex justify-center px-0 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:px-0">
      <div className="w-full overflow-hidden rounded-t-2xl bg-surface shadow-elevation-3 sm:w-96 sm:rounded-2xl">
        {/* Cabecera */}
        <div className="flex items-center gap-2 bg-content-primary px-4 py-3 text-content-inverse">
          <div className="flex items-center gap-2">
            {active > 0 ? (
              <Loader2 size={18} className="animate-spin" />
            ) : errors > 0 ? (
              <AlertCircle size={18} className="text-danger" />
            ) : (
              <CheckCircle2 size={18} className="text-success" />
            )}
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setMinimized((m) => !m)}
              className="rounded-full p-1 hover:bg-white/10"
              aria-label={minimized ? 'Expandir' : 'Minimizar'}
            >
              {minimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <button
              onClick={() => (active > 0 ? clearFinished() : dismissAll())}
              className="rounded-full p-1 hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Lista */}
        {!minimized && (
          <div className="max-h-72 divide-y divide-border overflow-y-auto">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onCancel={() => cancel(task.id)} onRetry={() => retry(task.id)} />
            ))}
          </div>
        )}

        {!minimized && (active === 0 || done > 0) && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-content-tertiary">
            <span>{formatBytes(tasks.reduce((s, t) => s + (t.status === 'done' ? t.size : 0), 0))} subidos</span>
            <button onClick={clearFinished} className="font-medium text-primary hover:underline">
              Limpiar completados
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
