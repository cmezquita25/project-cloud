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
        // Velos translúcidos y sin desenfoque propio: estos botones viven
        // sobre barras y paneles glass (blur anidado = parpadeo).
        'text-content-secondary hover:bg-slate-900/[0.06] active:bg-slate-900/[0.1] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]',
        'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
        s.box,
        className
      )}
      {...props}
    >
      <Icon size={s.icon} strokeWidth={2} />
    </button>
  )
})
