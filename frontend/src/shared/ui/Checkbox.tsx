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
        className="peer absolute inset-0 cursor-pointer appearance-none rounded border-2 border-border-strong bg-surface transition-colors checked:border-primary checked:bg-primary focus-visible:outline-focus"
        {...props}
      />
      <span className="pointer-events-none relative z-10 text-primary-on opacity-0 peer-checked:opacity-100">
        {indeterminate ? <Minus size={14} strokeWidth={3.5} /> : <Check size={14} strokeWidth={3.5} />}
      </span>
    </span>
  )
})
