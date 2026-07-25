import { MonitorDot, CheckCircle2, AlertTriangle, AlertCircle, Pencil } from 'lucide-react'
import { Button } from '@shared/ui'
import { formatBytes } from '@shared/lib/formatBytes'
import { cn } from '@shared/lib/cn'
import {
  SERVER_LIMITS,
  isPostSmallerThanUpload,
  type LimitStatus,
} from '../lib/serverLimits'

const STATUS_STYLE: Record<LimitStatus, string> = {
  good: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  bad: 'bg-danger/10 text-danger border-danger/20',
}

const STATUS_ICON = {
  good: CheckCircle2,
  warning: AlertTriangle,
  bad: AlertCircle,
}

const STATUS_LABEL: Record<LimitStatus, string> = {
  good: 'Óptimo',
  warning: 'Aceptable',
  bad: 'Crítico',
}

function ServerInfoCard({
  title,
  value,
  status,
  description,
  action,
}: {
  title: string
  value: string
  status: LimitStatus
  description: string
  action?: React.ReactNode
}) {
  const Icon = STATUS_ICON[status]
  return (
    <div className="flex flex-col gap-2 rounded-drive border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-content-secondary">{title}</p>
          <p className="mt-1 text-2xl font-medium text-content-primary">{value}</p>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', STATUS_STYLE[status])}>
            <Icon size={14} />
            <span>{STATUS_LABEL[status]}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-content-tertiary">{description}</p>
    </div>
  )
}

/**
 * Tarjetas de rendimiento y límites de PHP. Presentacional: recibe el mapa de
 * `server-info` y evalúa cada límite con los umbrales de `lib/serverLimits`.
 */
export function ServerLimits({
  serverInfo,
  chunkSizeBytes,
  onEditChunk,
}: {
  serverInfo: Record<string, string>
  chunkSizeBytes?: number
  onEditChunk?: () => void
}) {
  const postTooSmall = isPostSmallerThanUpload(
    serverInfo.post_max_size ?? 'N/A',
    serverInfo.upload_max_filesize ?? 'N/A',
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-content-primary">
          <MonitorDot size={20} className="text-primary" />
          <h2 className="text-lg font-medium">Rendimiento y límites del servidor (PHP)</h2>
        </div>
      </div>

      {postTooSmall && (
        <div className="flex items-start gap-2 rounded-drive border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>post_max_size</strong> es menor que <strong>upload_max_filesize</strong>: las subidas
            se cortarán antes de alcanzar el límite de archivo. Iguálalos o aumenta el POST.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {SERVER_LIMITS.map((limit) => (
          <ServerInfoCard
            key={limit.key}
            title={limit.title}
            value={serverInfo[limit.key] ?? 'N/A'}
            status={limit.status(serverInfo)}
            description={limit.description}
          />
        ))}

        {/* Card dedicada para Velocidad / Bloque HTTP de Subida */}
        <ServerInfoCard
          title="Velocidad de subida (Chunk HTTP)"
          value={formatBytes(chunkSizeBytes ?? 4194304)}
          status="good"
          description="Tamaño de cada paquete HTTP al transportar archivos por trozos. Optimiza la estabilidad y velocidad."
          action={
            onEditChunk ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={onEditChunk}
                leftIcon={Pencil}
                className="h-7 text-xs px-2.5"
              >
                Modificar
              </Button>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
