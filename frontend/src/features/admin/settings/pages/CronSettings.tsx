import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CircleDashed,
  Copy,
  Check,
  Play,
  ShieldCheck,
  KeyRound,
} from 'lucide-react'
import { Button, useToast, Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { cronApi, cronHealth, type CronHealth, type CronStatus, type CronTask } from '../../services/cronApi'

type Provider = 'plesk' | 'cpanel' | 'vps' | 'external'

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'plesk', label: 'Plesk' },
  { id: 'cpanel', label: 'cPanel' },
  { id: 'vps', label: 'VPS / Linux' },
  { id: 'external', label: 'Servicio externo' },
]

const HEALTH_UI: Record<CronHealth, { label: string; detail: string; icon: typeof CheckCircle2; className: string }> = {
  healthy: {
    label: 'Funcionando',
    detail: 'El cron se ejecuta correctamente cada minuto.',
    icon: CheckCircle2,
    className: 'bg-success/10 text-success border-success/20',
  },
  delayed: {
    label: 'Retrasado',
    detail: 'El cron se ejecuta con retraso. Revisa que la frecuencia sea * * * * * (cada minuto).',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  stopped: {
    label: 'Detenido',
    detail: 'El cron dejó de ejecutarse. Las tareas automáticas no se están realizando.',
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  never: {
    label: 'Sin configurar',
    detail: 'El cron aún no se ha ejecutado nunca. Sigue la guía de abajo para configurarlo.',
    icon: CircleDashed,
    className: 'bg-content-tertiary/10 text-content-tertiary border-border',
  },
}

/** Tiempo de espera de «Verificar configuración» y frecuencia de consulta. */
const VERIFY_TIMEOUT_MS = 3 * 60_000
const VERIFY_POLL_MS = 10_000

function formatInterval(seconds: number): string {
  if (seconds % 86400 === 0) return seconds === 86400 ? 'Cada día' : `Cada ${seconds / 86400} días`
  if (seconds % 3600 === 0) return seconds === 3600 ? 'Cada hora' : `Cada ${seconds / 3600} horas`
  return `Cada ${Math.round(seconds / 60)} min`
}

function formatAgo(iso: string | null, serverNow: string): string {
  if (!iso) return 'Nunca'
  const diff = Math.max(0, (new Date(serverNow).getTime() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'Hace unos segundos'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
  return `Hace ${Math.floor(diff / 86400)} d`
}

function formatResult(task: CronTask): string {
  if (task.ok === false) return task.error || 'Error desconocido'
  if (!task.result) return '—'
  return Object.entries(task.result)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' · ')
}

export function CronSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<Provider>('plesk')
  const [runningAll, setRunningAll] = useState(false)
  const [runningTask, setRunningTask] = useState<string | null>(null)
  const [verify, setVerify] = useState<{ since: string; startedAt: number } | null>(null)
  const [verifyResult, setVerifyResult] = useState<'ok' | 'timeout' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cron-status'],
    queryFn: cronApi.status,
    refetchInterval: verify ? VERIFY_POLL_MS : 60_000,
  })

  // «Verificar configuración»: espera a que el cron real del servidor responda
  // (las fechas vienen del servidor en el mismo formato ISO, comparables como texto).
  useEffect(() => {
    if (!verify || !data) return
    if (data.cron_last_run && data.cron_last_run > verify.since) {
      setVerify(null)
      setVerifyResult('ok')
    } else if (Date.now() - verify.startedAt > VERIFY_TIMEOUT_MS) {
      setVerify(null)
      setVerifyResult('timeout')
    }
  }, [data, verify])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'cron-status'] })

  const runAll = async () => {
    setRunningAll(true)
    try {
      const result = await cronApi.runAll()
      toast[result.ok ? 'success' : 'error'](result.ok ? 'Tareas ejecutadas' : 'Alguna tarea terminó con error')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ejecutar las tareas')
    } finally {
      setRunningAll(false)
    }
  }

  const runTask = async (key: string) => {
    setRunningTask(key)
    try {
      const result = await cronApi.runTask(key)
      toast[result.ok ? 'success' : 'error'](result.ok ? 'Tarea ejecutada' : 'La tarea terminó con error')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ejecutar la tarea')
    } finally {
      setRunningTask(null)
    }
  }

  const startVerify = () => {
    if (!data) return
    setVerifyResult(null)
    setVerify({ since: data.server_time, startedAt: Date.now() })
  }

  const regenerate = async () => {
    try {
      await cronApi.regenerateSecret()
      toast.success('URL regenerada. Actualízala en tu servicio externo.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo regenerar la URL')
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={28} />
      </div>
    )
  }

  const health = cronHealth(data)
  const healthUi = HEALTH_UI[health]
  const HealthIcon = healthUi.icon

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-content-primary">Tareas Cron del servidor</h2>
            <p className="text-sm text-content-secondary">
              Procesos automáticos: avisos de cuota, limpieza y, próximamente, copias y actualizaciones.
            </p>
          </div>
        </div>
        <Button onClick={runAll} loading={runningAll} leftIcon={RefreshCw} variant="secondary" className="shrink-0 whitespace-nowrap">
          Ejecutar todas ahora
        </Button>
      </div>

      {/* 1. Estado */}
      <section className="glass rounded-drive p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-medium text-content-primary">Estado del cron</h3>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', healthUi.className)}>
                <HealthIcon size={13} /> {healthUi.label}
              </span>
            </div>
            <p className="text-sm text-content-secondary">{healthUi.detail}</p>
            {data.cron_last_mode === 'http' && (
              <p className="text-xs text-amber-500">
                Se está ejecutando por URL. Si tu hosting lo permite, es mejor configurarlo como script PHP (más estable y sin token expuesto).
              </p>
            )}
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span className="block text-xs text-content-tertiary">Última ejecución del servidor</span>
            <span className="font-mono text-sm font-medium text-content-primary">
              {data.cron_last_run ? new Date(data.cron_last_run).toLocaleString() : 'Nunca'}
            </span>
            {data.cron_last_mode && (
              <span className="block text-xs text-content-tertiary">
                vía {data.cron_last_mode === 'cli' ? 'script PHP (CLI)' : 'URL (HTTP)'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <Button size="sm" leftIcon={ShieldCheck} loading={!!verify} onClick={startVerify}>
            {verify ? 'Esperando la primera ejecución…' : 'Verificar configuración'}
          </Button>
          <p className="text-xs text-content-secondary">
            {verifyResult === 'ok' && (
              <span className="text-success">
                ¡Listo! El cron respondió {data.cron_last_mode === 'cli' ? 'como script PHP' : 'por URL'} a las{' '}
                {data.cron_last_run ? new Date(data.cron_last_run).toLocaleTimeString() : ''}.
              </span>
            )}
            {verifyResult === 'timeout' && (
              <span className="text-amber-500">
                No hubo respuesta en 3 minutos. Revisa la ruta, la versión de PHP y que la frecuencia sea cada minuto.
              </span>
            )}
            {!verifyResult && !verify && 'Después de guardar la tarea en tu panel, pulsa aquí para comprobar que funciona.'}
            {verify && 'Comprobando cada 10 segundos (máximo 3 minutos)…'}
          </p>
        </div>
      </section>

      {/* 2. Guía */}
      <section className="glass rounded-drive p-6">
        <h3 className="text-base font-medium text-content-primary">Cómo configurarlo</h3>
        <p className="mt-1 text-sm text-content-secondary">
          Elige tu panel y sigue los pasos. Los valores ya vienen con las rutas reales de esta instalación.
        </p>

        <div className="mt-4 flex flex-wrap gap-1 rounded-xl bg-slate-900/[0.04] p-1 dark:bg-white/[0.05]" role="tablist">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={provider === p.id}
              onClick={() => setProvider(p.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                provider === p.id
                  ? 'bg-surface text-content-primary shadow-sm dark:bg-white/10'
                  : 'text-content-secondary hover:text-content-primary'
              )}
            >
              {p.label}
              {p.id === 'plesk' && <span className="ml-1 text-xs text-primary">Recomendado</span>}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <ProviderGuide provider={provider} data={data} onRegenerate={regenerate} />
        </div>
      </section>

      {/* 3. Tareas */}
      <section className="glass rounded-drive p-6">
        <h3 className="text-base font-medium text-content-primary">Tareas programadas</h3>
        <p className="mt-1 text-sm text-content-secondary">
          El cron del servidor corre cada minuto; cada tarea se ejecuta según su propio intervalo.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {data.tasks.map((task) => (
            <li key={task.key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-content-primary">{task.label}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{formatInterval(task.interval_seconds)}</span>
                  {task.ok === true && <CheckCircle2 size={14} className="text-success" aria-label="Correcta" />}
                  {task.ok === false && <AlertCircle size={14} className="text-red-500" aria-label="Con error" />}
                </div>
                <p className="mt-0.5 text-xs text-content-secondary">{task.description}</p>
                <p className={cn('mt-1 text-xs', task.ok === false ? 'text-red-500' : 'text-content-tertiary')}>
                  {formatAgo(task.last_run, data.server_time)} · {formatResult(task)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={Play}
                loading={runningTask === task.key}
                onClick={() => runTask(task.key)}
              >
                Ejecutar
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ProviderGuide({ provider, data, onRegenerate }: { provider: Provider; data: CronStatus; onRegenerate: () => void }) {
  if (provider === 'plesk') {
    return (
      <Steps
        steps={[
          <>Entra a Plesk → <b>Sitios web y dominios</b> → tu dominio → <b>Tareas programadas</b> (Scheduled Tasks).</>,
          <>Si ya existe una tarea con <code>cron.php</code>, ábrela para revisarla. Si no, pulsa <b>Añadir tarea</b>.</>,
          <>Tipo de tarea: <b>Ejecutar un script PHP</b>. En «Ruta del script» pega:<CopyField value={data.panel_path ?? data.script_path} /></>,
          <>Versión de PHP: la misma que usa el sitio (<b>PHP {data.php_version}</b>).</>,
          <>Ejecutar: <b>Cron style</b> con el valor<CopyField value="* * * * *" /></>,
          <>Notificar: <b>Solo errores</b>. Guarda la tarea y pulsa <b>Verificar configuración</b> arriba.</>,
        ]}
      />
    )
  }

  if (provider === 'cpanel') {
    return (
      <Steps
        steps={[
          <>Entra a cPanel → <b>Avanzado</b> → <b>Trabajos de Cron</b> (Cron Jobs).</>,
          <>En «Configuración común» elige <b>Una vez por minuto (* * * * *)</b>.</>,
          <>En «Comando» pega:<CopyField value={data.command} /></>,
          <>Pulsa <b>Añadir nuevo trabajo de Cron</b> y luego <b>Verificar configuración</b> arriba.</>,
        ]}
        note="Si cPanel usa otra ruta de PHP (p. ej. /usr/local/bin/php o ea-php83), cámbiala al inicio del comando."
      />
    )
  }

  if (provider === 'vps') {
    return (
      <Steps
        steps={[
          <>Conéctate por SSH con el <b>usuario dueño de los archivos del sitio</b> (no uses <code>root</code>).</>,
          <>Abre el editor de tareas con<CopyField value="crontab -e" /></>,
          <>Añade esta línea al final y guarda:<CopyField value={data.crontab_line} /></>,
          <>Comprueba que quedó registrada con<CopyField value="crontab -l" /></>,
          <>Pulsa <b>Verificar configuración</b> arriba.</>,
        ]}
      />
    )
  }

  return (
    <Steps
      steps={[
        <>Úsalo solo si tu hosting <b>no permite</b> tareas programadas.</>,
        <>Crea una cuenta en un servicio como <b>cron-job.org</b> y añade una tarea nueva.</>,
        <>URL a llamar (método GET):<CopyField value={data.cron_url} secret /></>,
        <>Frecuencia: <b>cada minuto</b>. Guarda y pulsa <b>Verificar configuración</b> arriba.</>,
      ]}
      note={
        <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span>Esta URL lleva un token secreto: no la compartas. Si se filtra, genera una nueva.</span>
          <Button size="sm" variant="secondary" leftIcon={KeyRound} onClick={onRegenerate}>
            Regenerar URL
          </Button>
        </span>
      }
    />
  )
}

function Steps({ steps, note }: { steps: ReactNode[]; note?: ReactNode }) {
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-content-secondary">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5 [&_b]:font-medium [&_b]:text-content-primary [&_code]:font-mono [&_code]:text-xs">{step}</div>
          </li>
        ))}
      </ol>
      {note && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-content-secondary">{note}</div>}
    </div>
  )
}

/** Valor con botón de copiar. Los secretos se muestran ocultos hasta pasar el ratón o enfocar. */
function CopyField({ value, secret = false }: { value: string; secret?: boolean }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.')
    }
  }

  return (
    <div className="mt-2 flex items-stretch gap-2">
      <code
        tabIndex={0}
        className={cn(
          'min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-slate-900/[0.04] px-3 py-2 font-mono text-xs text-content-primary dark:bg-white/[0.05]',
          secret && 'blur-[3px] transition hover:blur-0 focus:blur-0'
        )}
      >
        {value}
      </code>
      <Button size="sm" variant="secondary" leftIcon={copied ? Check : Copy} onClick={copy} aria-label="Copiar">
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  )
}
