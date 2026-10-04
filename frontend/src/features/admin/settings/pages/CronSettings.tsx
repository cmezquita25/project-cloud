import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Globe,
  Sparkles,
  HardDrive,
  Share2,
  Trash2,
  Activity,
} from 'lucide-react'
import { Button, useToast, Spinner } from '@shared/ui'
import { api } from '@shared/api'

interface CronStatusData {
  cron_last_run: string | null
  cron_secret: string
  cron_command: string
  cron_url: string
}

export function CronSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cron-status'],
    queryFn: () => api.get<CronStatusData>('/admin/cron'),
  })

  const handleRunNow = async () => {
    setRunning(true)
    try {
      await api.post<any>('/admin/cron/run')
      toast.success('Tareas Cron sincronizadas exitosamente')
      queryClient.invalidateQueries({ queryKey: ['admin', 'cron-status'] })
    } catch (err: any) {
      toast.error(err?.message || 'Error al ejecutar las tareas Cron')
    } finally {
      setRunning(false)
    }
  }

  const copyToClipboard = (text: string, type: 'cmd' | 'url') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    if (type === 'cmd') {
      setCopiedCommand(true)
      setTimeout(() => setCopiedCommand(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
    toast.success('Copiado al portapapeles')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={28} />
      </div>
    )
  }

  const lastRun = data?.cron_last_run
  const isHealthy = lastRun && Date.now() - new Date(lastRun).getTime() < 300000 // Menos de 5 min

  const cronCommand = data?.cron_command ?? '* * * * * php /path/to/api/cron.php >/dev/null 2>&1'
  const cronUrl = data?.cron_url ?? `${window.location.origin}/api/cron.php?token=${data?.cron_secret || ''}`

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-content-primary">Tareas Cron del Servidor</h2>
            <p className="text-sm text-content-secondary">
              Gestiona los procesos en segundo plano para avisos de cuota, notificaciones e higiene del servidor.
            </p>
          </div>
        </div>

        <Button onClick={handleRunNow} loading={running} leftIcon={RefreshCw}>
          Sincronizar ahora
        </Button>
      </div>

      {/* Tarjeta de Estado del Cron */}
      <div className="rounded-drive glass p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-content-primary">Estado de la Programación</h3>
              {lastRun ? (
                isHealthy ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success border border-success/20">
                    <CheckCircle2 size={13} /> Activo y Sincronizado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
                    <AlertCircle size={13} /> Ejecutado anteriormente
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-content-tertiary/10 px-2.5 py-0.5 text-xs font-medium text-content-tertiary border border-border">
                  <AlertCircle size={13} /> Sin ejecuciones recientes
                </span>
              )}
            </div>
            <p className="text-xs text-content-secondary">
              Intervalo recomendado: <strong className="text-content-primary font-mono">Cada 60 segundos (* * * * *)</strong>
            </p>
          </div>

          <div className="text-right sm:text-left">
            <span className="text-xs text-content-tertiary block">Última ejecución:</span>
            <span className="text-sm font-medium text-content-primary font-mono">
              {lastRun ? new Date(lastRun).toLocaleString() : 'Nunca ejecutado'}
            </span>
          </div>
        </div>
      </div>

      {/* Configuración Recomendada en el Hosting */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-content-primary flex items-center gap-2">
          <Terminal size={18} className="text-primary" />
          <span>Configuración del Cron en tu Proveedor de Hosting</span>
        </h3>

        {/* Opción 1: Tarea Programada CLI */}
        <div className="rounded-drive glass p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-content-primary flex items-center gap-2">
              <span>Opción 1: Comando CLI de Linux / cPanel / Plesk (Recomendado)</span>
            </h4>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={copiedCommand ? Check : Copy}
              onClick={() => copyToClipboard(cronCommand, 'cmd')}
            >
              {copiedCommand ? 'Copiado' : 'Copiar comando'}
            </Button>
          </div>
          <p className="text-xs text-content-secondary leading-relaxed">
            Agrega esta línea en la sección de <strong>Tareas Cron / Scheduled Tasks</strong> de tu panel cPanel o Plesk configurando el tiempo en <code>* * * * *</code> (cada minuto).
          </p>
          <div className="rounded-xl border border-border bg-slate-900/[0.04] dark:bg-white/[0.05]-highest p-3 font-mono text-xs text-content-primary overflow-x-auto select-all">
            {cronCommand}
          </div>
        </div>

        {/* Opción 2: Webhook HTTP */}
        <div className="rounded-drive glass p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-content-primary flex items-center gap-2">
              <Globe size={16} className="text-sky-500" />
              <span>Opción 2: Webhook HTTP (Servicios de Cron Externos)</span>
            </h4>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={copiedUrl ? Check : Copy}
              onClick={() => copyToClipboard(cronUrl, 'url')}
            >
              {copiedUrl ? 'Copiado' : 'Copiar URL'}
            </Button>
          </div>
          <p className="text-xs text-content-secondary leading-relaxed">
            Si tu hosting no permite ejecutar la CLI de PHP, configura una solicitud HTTP GET periódica hacia la siguiente URL protegida:
          </p>
          <div className="rounded-xl border border-border bg-slate-900/[0.04] dark:bg-white/[0.05]-highest p-3 font-mono text-xs text-content-primary overflow-x-auto select-all">
            {cronUrl}
          </div>
        </div>

        {/* Lista estructurada de características notificadas y ejecutadas */}
        <div className="rounded-drive border border-primary/20 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h4 className="font-medium text-sm text-primary">Procesos y Alertas Automatizados</h4>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <li className="flex items-start gap-2.5 text-xs text-content-secondary">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <HardDrive size={13} />
              </div>
              <div>
                <strong className="text-content-primary block font-medium">Alertas de Almacenamiento (≥90%)</strong>
                <span>Notifica por correo y web al usuario al acercarse a su cuota límite.</span>
              </div>
            </li>

            <li className="flex items-start gap-2.5 text-xs text-content-secondary">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share2 size={13} />
              </div>
              <div>
                <strong className="text-content-primary block font-medium">Archivos en Carpetas Compartidas</strong>
                <span>Avisa a los colaboradores invitados cuando se sube un nuevo recurso en Mi Unidad.</span>
              </div>
            </li>

            <li className="flex items-start gap-2.5 text-xs text-content-secondary">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <Trash2 size={13} />
              </div>
              <div>
                <strong className="text-content-primary block font-medium">Higiene de Archivos Temporales</strong>
                <span>Limpia fragmentos de subidas inconclusas por chunks mayores a 24 horas.</span>
              </div>
            </li>

            <li className="flex items-start gap-2.5 text-xs text-content-secondary">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Activity size={13} />
              </div>
              <div>
                <strong className="text-content-primary block font-medium">Sincronización Periódica</strong>
                <span>Mantiene actualizadas las métricas de uso y estadísticas del servidor.</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
