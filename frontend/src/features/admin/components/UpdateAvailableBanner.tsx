import { Link } from 'react-router-dom'
import { ArrowRight, DownloadCloud } from 'lucide-react'
import { useUpdateBadge } from '../hooks/useUpdateBadge'

/** Aviso del dashboard (solo admins) cuando hay una versión nueva de la plataforma. */
export function UpdateAvailableBanner() {
  const version = useUpdateBadge()
  if (!version) return null

  return (
    <div className="flex flex-col gap-3 rounded-drive border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <DownloadCloud size={20} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-content-primary">Actualización disponible: v{version}</p>
        <p className="text-content-secondary">Revisa las novedades e instálala desde Configuración. Te pediremos una copia de seguridad antes.</p>
      </div>
      <Link
        to="/admin/settings/updates"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Ver detalles <ArrowRight size={14} />
      </Link>
    </div>
  )
}
