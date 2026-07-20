import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  fullWidth?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-gradient-start to-gradient-end text-primary-on hover:opacity-90 active:brightness-95',
  secondary:
    'bg-surface text-primary border border-border hover:bg-surface-hover active:bg-surface-active',
  tonal: 'bg-primary-subtle text-primary hover:brightness-95 dark:hover:brightness-110',
  ghost: 'bg-transparent text-content-secondary hover:bg-surface-hover active:bg-surface-active',
  danger: 'bg-danger text-danger-on hover:brightness-95 active:brightness-90 shadow-elevation-1',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-pill',
  md: 'h-10 px-5 text-sm gap-2 rounded-pill',
  lg: 'h-12 px-6 text-base gap-2 rounded-pill',
}

const ICON_SIZE: Record<Size, number> = { sm: 16, md: 18, lg: 20 }

/** Botón base del design system, con variantes y estados estilo Google. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    fullWidth = false,
    disabled,
    className,
    children,
    ...props
  },
  ref
) {
  const iconSize = ICON_SIZE[size]
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors',
        'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50',
        SIZES[size],
        VARIANTS[variant],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={iconSize} />
      ) : (
        LeftIcon && <LeftIcon size={iconSize} strokeWidth={2} />
      )}
      {children}
      {!loading && RightIcon && <RightIcon size={iconSize} strokeWidth={2} />}
    </button>
  )
})
