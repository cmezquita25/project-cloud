import { useMemo } from 'react'
import { cn } from '@shared/lib/cn'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  className?: string
}

// Paleta determinista de colores de fondo para iniciales.
const BG_COLORS = [
  'bg-primary',
  'bg-success',
  'bg-danger',
  'bg-[#9334e6]', // púrpura Google
  'bg-[#e8710a]', // naranja Google
  'bg-[#12b5cb]', // cian Google
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + second).toUpperCase() || '?'
}

function hashIndex(str: string, mod: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % mod
}

/** Avatar de usuario: imagen si existe, si no iniciales con color determinista. */
export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  const bg = useMemo(() => BG_COLORS[hashIndex(name, BG_COLORS.length)], [name])

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn('rounded-full object-cover shrink-0', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white',
        bg,
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </span>
  )
}
