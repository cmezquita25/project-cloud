import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MonitorDot, CheckCircle2, AlertTriangle, AlertCircle, Pencil, Info } from 'lucide-react'
import { Button, Dialog, Input, useToast } from '@shared/ui'
import { formatBytes } from '@shared/lib/formatBytes'
import { cn } from '@shared/lib/cn'
import { adminApi } from '../services/adminApi'
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
    <div className="flex flex-col gap-2 rounded-drive glass p-4">
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

/** Normaliza entradas como "256" a "256M" o "100" a "100M" si no tienen unidad. */
function ensureUnit(val: string, defaultUnit = 'M'): string {
  const trimmed = val.trim()
  if (!trimmed) return ''
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}${defaultUnit}`
  }
  return trimmed
}

/**
 * Tarjetas de rendimiento y límites de PHP.
 * Permite editar la configuración desde el panel admin y persistirla en config/config.php.
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
  const toast = useToast()
  const queryClient = useQueryClient()
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    memory_limit: serverInfo.memory_limit ?? '512M',
    upload_max_filesize: serverInfo.upload_max_filesize ?? '2048M',
    post_max_size: serverInfo.post_max_size ?? '2048M',
    max_execution_time: serverInfo.max_execution_time ?? '300',
    max_input_time: serverInfo.max_input_time ?? '300',
  })

  const openModal = () => {
    setForm({
      memory_limit: serverInfo.memory_limit ?? '512M',
      upload_max_filesize: serverInfo.upload_max_filesize ?? '2048M',
      post_max_size: serverInfo.post_max_size ?? '2048M',
      max_execution_time: serverInfo.max_execution_time ?? '300',
      max_input_time: serverInfo.max_input_time ?? '300',
    })
    setShowEditModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const memory_limit = ensureUnit(form.memory_limit)
      const upload_max_filesize = ensureUnit(form.upload_max_filesize)
      const post_max_size = ensureUnit(form.post_max_size)

      await adminApi.updatePhpLimits({
        memory_limit,
        upload_max_filesize,
        post_max_size,
        max_execution_time: parseInt(form.max_execution_time, 10) || 300,
        max_input_time: parseInt(form.max_input_time, 10) || 300,
      })
      toast.success('Configuración guardada en config.php exitosamente')
      queryClient.invalidateQueries({ queryKey: ['admin', 'server-info'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setShowEditModal(false)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la configuración en config.php')
    } finally {
      setSaving(false)
    }
  }

  const postTooSmall = isPostSmallerThanUpload(
    serverInfo.post_max_size ?? 'N/A',
    serverInfo.upload_max_filesize ?? 'N/A',
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-content-primary">
          <MonitorDot size={20} className="text-primary" />
          <h2 className="text-lg font-medium">Configuraciones del servidor</h2>
        </div>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={Pencil}
          onClick={openModal}
          className="h-8 text-xs px-3"
        >
          Modificar
        </Button>
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

      <Dialog
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Modificar Configuraciones de la Plataforma (config.php)"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="rounded-drive border border-primary/20 bg-primary/5 p-4 text-xs text-content-secondary space-y-2">
            <div className="flex items-center gap-2 font-medium text-sm text-primary">
              <Info size={18} />
              <span>Configuración Independiente de la Plataforma (config.php)</span>
            </div>
            <p className="leading-relaxed">
              Esta configuración se almacena en el archivo de entorno propio de la aplicación (<code>config/config.php</code>), permitiendo controlar los límites operativos de la plataforma de manera independiente.
            </p>
            <p className="leading-relaxed text-content-tertiary">
              <strong className="text-content-secondary">Nota del servidor:</strong> Asegúrate de verificar los límites reales asignados por tu proveedor de alojamiento (Plesk, cPanel o el php.ini raíz del VPS), ya que el servidor siempre aplicará la cota física más restrictiva.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <Input
              label="Límite de memoria (memory_limit)"
              placeholder="512M, 1024M, 2048M"
              value={form.memory_limit}
              onChange={(e) => setForm((f) => ({ ...f, memory_limit: e.target.value }))}
              hint="Ej: 256M, 512M o 1024M"
              required
            />
            <Input
              label="Subida máx. (upload_max_filesize)"
              placeholder="100M, 2048M"
              value={form.upload_max_filesize}
              onChange={(e) => setForm((f) => ({ ...f, upload_max_filesize: e.target.value }))}
              hint="Ej: 100M o 2048M"
              required
            />
            <Input
              label="POST máx. (post_max_size)"
              placeholder="100M, 2048M"
              value={form.post_max_size}
              onChange={(e) => setForm((f) => ({ ...f, post_max_size: e.target.value }))}
              hint="Debe ser ≥ upload_max_filesize"
              required
            />
            <Input
              label="Tiempo máx. ejecución (seg.)"
              type="number"
              placeholder="300"
              value={form.max_execution_time}
              onChange={(e) => setForm((f) => ({ ...f, max_execution_time: e.target.value }))}
              hint="Ej: 300 (5 min) o 600 (10 min)"
              required
            />
            <Input
              label="Tiempo máx. entrada (seg.)"
              type="number"
              placeholder="300"
              value={form.max_input_time}
              onChange={(e) => setForm((f) => ({ ...f, max_input_time: e.target.value }))}
              hint="Ej: 300 o -1 (sin límite)"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar en config.php
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
