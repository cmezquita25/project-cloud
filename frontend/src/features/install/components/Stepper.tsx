import { Check } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface StepperProps {
  steps: string[]
  current: number
}

/**
 * Indicador de pasos (estilo Material). El número/check va en el círculo y la
 * etiqueta debajo, centrada, para que sea responsive: nunca desborda ni se
 * encima; en pantallas estrechas la etiqueta puede ocupar dos líneas.
 */
export function Stepper({ steps, current }: StepperProps) {
  const last = steps.length - 1
  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 flex-col items-center">
            {/* Fila del círculo con conectores a izquierda/derecha */}
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors',
                  i === 0 ? 'invisible' : done || active ? 'bg-primary' : 'bg-border'
                )}
              />
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
                  'h-0.5 flex-1 rounded-full transition-colors',
                  i === last ? 'invisible' : done ? 'bg-primary' : 'bg-border'
                )}
              />
            </div>
            {/* Etiqueta bajo el círculo */}
            <span
              className={cn(
                'mt-2 max-w-[6rem] text-center text-xs font-medium leading-tight transition-colors',
                active ? 'text-content-primary' : 'text-content-tertiary'
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
