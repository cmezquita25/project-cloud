import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: LucideIcon
}

/** Campo de texto con etiqueta flotante superior, hint y estado de error. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon: LeftIcon, className, id, ...props },
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
            'h-11 w-full rounded-drive border bg-surface px-3.5 text-content-primary',
            'placeholder:text-content-tertiary',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-60',
            LeftIcon && 'pl-11',
            error ? 'border-danger focus:ring-danger' : 'border-border-strong',
            className
          )}
          {...props}
        />
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
