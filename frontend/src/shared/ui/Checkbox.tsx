import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean
}

/** Casilla estilizada (selección de archivos, opciones). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { indeterminate = false, checked, className, ...props },
  ref
) {
  return (
    <span className={cn('relative inline-flex h-5 w-5 items-center justify-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        className={cn(
          'peer absolute inset-0 cursor-pointer appearance-none rounded border-2 border-border-strong bg-white/70 transition-all dark:bg-white/[0.04]',
          // Marcada: color sólido del estilo (azul en Blizzard, morado en
          // Nebula, el primario elegido si está personalizado) con un halo
          // suave. Sólido y no degradado: el degradado azul → morado de Nebula
          // en una caja tan pequeña se veía sucio.
          // `dark:checked:` explícito: `dark:bg-white/[0.04]` (desmarcada) se genera
          // después de `checked:` y, si no, ganaría también estando marcada.
          'checked:border-transparent checked:bg-check dark:checked:bg-check checked:shadow-[0_2px_10px_-2px_rgb(var(--color-check)/0.6)]',
          'focus-visible:outline-focus'
        )}
        {...props}
      />
      <span className="pointer-events-none relative z-10 text-white opacity-0 peer-checked:opacity-100">
        {indeterminate ? <Minus size={14} strokeWidth={3.5} /> : <Check size={14} strokeWidth={3.5} />}
      </span>
    </span>
  )
})
