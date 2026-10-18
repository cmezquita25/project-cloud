import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { cronApi, cronHealth } from '../services/cronApi'

/**
 * Aviso del dashboard (solo admins) cuando el cron del servidor no funciona:
 * sin él no hay avisos de cuota, limpieza ni (más adelante) copias automáticas
 * o búsqueda de actualizaciones.
 */
export function CronHealthAlert() {
  const { data } = useQuery({
    queryKey: ['admin', 'cron-status'],
    queryFn: cronApi.status,
    staleTime: 5 * 60_000,
  })

  if (!data) return null
  const health = cronHealth(data)
  if (health !== 'stopped' && health !== 'never') return null

  return (
    <div className="flex flex-col gap-3 rounded-drive border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
      <AlertCircle size={20} className="shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-content-primary">
          {health === 'never' ? 'El cron del servidor no está configurado' : 'El cron del servidor dejó de ejecutarse'}
        </p>
        <p className="text-content-secondary">
          Sin él no se envían los avisos de cuota ni se hace la limpieza automática. Configurarlo toma 2 minutos.
        </p>
      </div>
      <Link
        to="/admin/settings/cron"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Configurar cron <ArrowRight size={14} />
      </Link>
    </div>
  )
}
