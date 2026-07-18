import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'

type Size = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Etiqueta accesible obligatoria (no hay texto visible). */
  label: string
  size?: Size
  active?: boolean
}

const SIZES: Record<Size, { box: string; icon: number }> = {
  sm: { box: 'h-8 w-8', icon: 18 },
  md: { box: 'h-10 w-10', icon: 20 },
  lg: { box: 'h-12 w-12', icon: 24 },
}

/** Botón circular de solo icono (acciones de topbar, menús, toolbars). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', active = false, className, ...props },
  ref
) {
  const s = SIZES[size]
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-colors',
        'text-content-secondary hover:bg-surface-hover active:bg-surface-active',
        'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-primary-subtle text-primary',
        s.box,
        className
      )}
      {...props}
    >
      <Icon size={s.icon} strokeWidth={2} />
    </button>
  )
})
