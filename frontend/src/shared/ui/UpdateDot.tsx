import { cn } from '@shared/lib/cn'

/** Punto de aviso «hay una actualización disponible» para menús y pestañas. */
export function UpdateDot({ className, label = 'Actualización disponible' }: { className?: string; label?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} role="status" aria-label={label} title={label}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  )
}
