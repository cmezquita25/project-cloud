import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

/** Estado vacío ilustrado (carpetas sin contenido, sin resultados, etc.). */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Icono en un círculo glass con un halo de marca detrás (`.orb`,
          degradado radial: decorativo y sin coste de filtro). */}
      <div className="relative mb-4">
        <div aria-hidden="true" className="orb pointer-events-none absolute -inset-8 text-glow-a/20" />
        <div className="glass relative flex h-20 w-20 items-center justify-center rounded-full text-primary">
          <Icon size={40} strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-content-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-content-secondary">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
