import { useId } from 'react'
import { cn } from '@shared/lib/cn'

interface SpinnerProps {
  size?: number
  className?: string
  label?: string
  /**
   * `current` (por defecto): un solo color, el del texto. Es el que va dentro
   * de botones y no debe cambiar.
   * `brand`: arco con el degradado de marca, como el anillo de carga de la
   * landing. Para cargas de pantalla completa.
   */
  tone?: 'current' | 'brand'
}

/** Indicador de carga circular. */
export function Spinner({ size = 20, className, label = 'Cargando', tone = 'current' }: SpinnerProps) {
  // Id único por instancia: dos spinners con el mismo id de degradado se
  // pisarían el `url(#…)`.
  const gradientId = `spinner-${useId().replace(/:/g, '')}`
  const brand = tone === 'brand'

  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block animate-spin', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
        {brand && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: 'rgb(var(--glow-b))' }} />
              <stop offset="100%" style={{ stopColor: 'rgb(var(--glow-a))' }} />
            </linearGradient>
          </defs>
        )}
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke={brand ? `url(#${gradientId})` : 'currentColor'}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
