import { cn } from '@shared/lib/cn'

interface AppBackdropProps {
  /**
   * Deriva lenta de los halos. Solo en las pantallas de acceso e instalación:
   * dentro de la app los halos quedan quietos, porque lo que se mueve detrás
   * de una superficie con `backdrop-filter` obliga a recalcular su desenfoque
   * en cada frame.
   */
  animated?: boolean
}

/**
 * Fondo de marca: rejilla técnica + tres halos de luz (portado de la landing).
 *
 * Es lo que le da algo que desenfocar al glass; sobre un color plano el blur
 * se ve como un gris apagado.
 *
 * Se monta como HERMANO del contenido, nunca envolviéndolo, y queda en
 * `-z-10`: por debajo de todo el contenido sin posicionar y sin crear un
 * contexto de apilamiento que altere el orden de las capas existentes
 * (drawer, UploadDock, menús en Portal). Por eso ningún ancestro suyo puede
 * llevar fondo propio: lo taparía. El color de base lo pinta `body`.
 *
 * Los halos usan `.orb` (degradado radial con `currentColor`), no
 * `filter: blur()`; el color sale de `text-glow-*`, que sigue al preset y a
 * los colores personalizados.
 */
export function AppBackdrop({ animated = false }: AppBackdropProps) {
  const drift = animated && 'animate-aurora-drift'
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="grid-surface absolute inset-0" />
      <div
        className={cn(
          'orb absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 text-glow-a/20 dark:text-glow-a/25',
          drift
        )}
      />
      <div
        className={cn('orb absolute -left-40 top-24 h-80 w-80 text-glow-b/15 dark:text-glow-b/20', drift)}
        style={animated ? { animationDelay: '-6s' } : undefined}
      />
      <div
        className={cn('orb absolute -right-40 top-40 h-96 w-96 text-glow-c/20 dark:text-glow-c/25', drift)}
        style={animated ? { animationDelay: '-12s' } : undefined}
      />
    </div>
  )
}
