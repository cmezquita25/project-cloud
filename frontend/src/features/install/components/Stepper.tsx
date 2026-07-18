import { Check } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface StepperProps {
  steps: string[]
  current: number
}

/** Indicador de pasos horizontal (estilo Material). */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  done && 'bg-primary text-primary-on',
                  active && 'bg-primary text-primary-on ring-4 ring-primary-subtle',
                  !done && !active && 'bg-surface-hover text-content-tertiary'
                )}
              >
                {done ? <Check size={16} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  active ? 'text-content-primary' : 'text-content-tertiary'
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'mx-3 h-px flex-1 transition-colors',
                  done ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
