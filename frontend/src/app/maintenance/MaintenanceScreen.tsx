import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Wrench, DownloadCloud, History } from 'lucide-react'
import { maintenance, type MaintenanceStatus } from '@shared/api'
import { AppBackdrop, Button } from '@shared/ui'
import { reloadWithFreshCache, usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useTheme } from '@app/providers/ThemeProvider'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { getVersionLabel } from '@shared/config/version'

const COPY = {
  update: {
    icon: DownloadCloud,
    title: 'Actualización en curso',
    text: 'Estamos instalando una nueva versión de la plataforma.',
  },
  restore: {
    icon: History,
    title: 'Restauración en curso',
    text: 'Estamos restaurando la plataforma desde una copia de seguridad.',
  },
  manual: {
    icon: Wrench,
    title: 'Plataforma en mantenimiento',
    text: 'Estamos realizando tareas de mantenimiento.',
  },
} as const

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Pantalla que ven los usuarios mientras la plataforma está en mantenimiento. */
export function MaintenanceScreen({ status }: { status: MaintenanceStatus }) {
  const settings = usePlatformSettings()
  const { resolved: theme } = useTheme()
  const [checking, setChecking] = useState(false)

  const copy = status.reason === 'update' || status.reason === 'restore' ? COPY[status.reason] : COPY.manual
  const Icon = copy.icon
  // Mientras llega la configuración no se muestra nada (antes salía «Project Cloud» un instante).
  const orgName = settings ? settings.organization_name || 'Project Cloud' : ''
  const hasLogo = !!(settings && (settings.logo_white || settings.logo_dark))
  const logoVariant = theme === 'light' && settings?.logo_dark ? 'dark' : 'white'

  const retry = async () => {
    setChecking(true)
    try {
      const s = await maintenance.fetchStatus()
      if (!s.active) {
        reloadWithFreshCache()
        return
      }
      maintenance.set(s)
    } catch {
      /* sigue en mantenimiento o sin conexión */
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden p-4">
      <AppBackdrop animated />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-center">
          {hasLogo ? (
            <img src={`/api/v1/settings/logo/${logoVariant}`} alt={orgName} className="h-12 max-w-[200px] object-contain" />
          ) : (
            <span className="text-gradient text-2xl font-semibold">{orgName}</span>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.2 }}
          className="glass-strong rounded-2xl p-8 text-center ring-1 ring-slate-900/5 dark:ring-white/10"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon size={28} />
          </div>
          <h1 className="text-xl font-semibold text-content-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-content-secondary">{status.message || copy.text}</p>
          <p className="mt-4 text-sm text-content-secondary">
            Inténtalo de nuevo en unos minutos o consulta a tu administrador.
          </p>

          {status.expires_at && (
            <p className="mt-3 text-xs text-content-tertiary">
              Tiempo estimado: hasta las <span className="font-medium">{formatTime(status.expires_at)}</span>
            </p>
          )}

          <div className="mt-6 flex flex-col items-center gap-2">
            <Button variant="secondary" leftIcon={RefreshCw} loading={checking} onClick={retry}>
              Reintentar ahora
            </Button>
            <p className="text-xs text-content-tertiary">La página se recargará sola cuando la plataforma esté lista.</p>
          </div>
        </motion.div>

        <p className="mt-8 text-center text-xs font-medium text-content-tertiary">{getVersionLabel()}</p>
      </div>

      <div className="glass-strong glass-hover fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full">
        <ThemeToggle />
      </div>
    </div>
  )
}
