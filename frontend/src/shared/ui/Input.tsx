import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: LucideIcon
  rightElement?: React.ReactNode
}

/** Campo de texto con etiqueta flotante superior, hint y estado de error. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon: LeftIcon, rightElement, className, id, ...props },
  ref
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-content-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon
            size={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            // `input-glass`: tinte translúcido + borde fino (sin blur). El
            // foco es el de la landing: borde y anillo con el color de foco.
            'input-glass h-11 w-full rounded-drive px-3.5 text-content-primary',
            'placeholder:text-content-tertiary',
            'disabled:cursor-not-allowed disabled:opacity-60',
            LeftIcon && 'pl-11',
            rightElement && 'pr-11',
            // Con error no se usa `ring-glow-focus`: pintaría el borde con el
            // color de foco y taparía el rojo justo al escribir.
            error
              ? 'border-danger focus:outline-none focus:ring-2 focus:ring-danger/25'
              : 'ring-glow-focus',
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className="text-xs text-content-tertiary">
            {hint}
          </p>
        )
      )}
    </div>
  )
})
