import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@shared/lib/cn'

interface MockWindowProps {
  title?: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Fondo oscuro propio (la vista previa de temas lo cambia). */
  dark?: boolean
}

/**
 * Marco de «ventana» para las reproducciones visuales de las novedades. No son
 * capturas: son mini-componentes vivos con el aspecto de la plataforma.
 */
export function MockWindow({ title, children, className, style, dark = false }: MockWindowProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        'pointer-events-none w-full select-none overflow-hidden rounded-xl shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] ring-1',
        dark ? 'ring-white/10' : 'bg-surface ring-slate-900/10 dark:bg-slate-900/80 dark:ring-white/10',
        className
      )}
    >
      <div className={cn('flex items-center gap-1.5 border-b px-3 py-2', dark ? 'border-white/10' : 'border-slate-900/[0.06] dark:border-white/[0.08]')}>
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        {title && <span className={cn('ml-2 truncate text-[10px] font-medium', dark ? 'text-white/60' : 'text-content-tertiary')}>{title}</span>}
      </div>
      {children}
    </div>
  )
}
