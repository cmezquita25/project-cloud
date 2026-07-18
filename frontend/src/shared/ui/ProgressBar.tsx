import { cn } from '@shared/lib/cn'

interface ProgressBarProps {
  /** Valor 0–100. Omitir para modo indeterminado. */
  value?: number
  className?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
}

const TONE: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/** Barra de progreso (subidas, uso de almacenamiento). */
export function ProgressBar({ value, className, tone = 'primary', size = 'md' }: ProgressBarProps) {
  const indeterminate = value === undefined
  const height = size === 'sm' ? 'h-1' : 'h-2'
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full overflow-hidden rounded-pill bg-surface-hover', height, className)}
    >
      <div
        className={cn(
          'h-full rounded-pill transition-[width] duration-300 ease-out',
          TONE[tone],
          indeterminate && 'w-1/3 animate-[slide-in-right_1s_ease-in-out_infinite]'
        )}
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
