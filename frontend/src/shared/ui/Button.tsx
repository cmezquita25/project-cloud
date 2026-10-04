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

/*
  Variantes con el sistema visual Invicter (ver `index.css`).

  - primary: degradado de marca + `btn-glow` (halo y elevación al hover). El
    degradado sale de los tokens, así que sigue al preset y a los colores
    personalizados de Apariencia.
  - secondary: `glass-lite` (mismo aspecto glass, SIN `backdrop-filter`). Estos
    botones viven casi siempre dentro de diálogos y paneles glass, y un
    desenfoque anidado parpadea.
  - tonal / ghost: tintes translúcidos en vez de superficies sólidas.
  - danger: degradado rojo con halo propio.
*/
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-gradient-start to-gradient-end text-btn-text btn-glow disabled:shadow-none',
  secondary: 'glass-lite glass-hover text-primary',
  tonal: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 hover:bg-primary/15 active:bg-primary/20',
  ghost:
    'bg-transparent text-content-secondary hover:bg-slate-900/[0.05] active:bg-slate-900/[0.08] dark:hover:bg-white/[0.07] dark:active:bg-white/[0.1]',
  danger:
    'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_10px_30px_-10px_rgb(220_38_38/0.6)] hover:brightness-110 active:brightness-95 disabled:shadow-none',
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
        // `transition-all` y no `transition-colors`: una utilidad gana a la
        // transición de `.btn-glow`/`.glass-hover`, y con solo colores la
        // elevación y el halo del hover saltarían en vez de animarse.
        'inline-flex select-none items-center justify-center font-medium transition-all duration-300 ease-out-expo',
        'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50',
        SIZES[size],
        VARIANTS[variant],
        // Cargando: el degradado se desplaza, como los CTA de la landing.
        // Tres paradas (inicio → fin → inicio) para que el bucle no salte.
        loading &&
          variant === 'primary' &&
          'via-gradient-end to-gradient-start bg-[length:200%_auto] animate-gradient-x',
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
