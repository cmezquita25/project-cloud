import { useRef, type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useClickOutside } from '@shared/hooks/useClickOutside'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { BottomSheet } from './BottomSheet'

export interface MenuItem {
  id: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** Inserta un separador antes de este ítem. */
  divider?: boolean
}

interface MenuProps {
  open: boolean
  onClose: () => void
  items: MenuItem[]
  /** Título mostrado solo en la variante móvil (bottom sheet). */
  title?: string
  /** Alineación del dropdown en escritorio. */
  align?: 'left' | 'right'
  children?: ReactNode
}

function ItemRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const Icon = item.icon
  return (
    <>
      {item.divider && <div className="my-1 h-px bg-border" role="separator" />}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onClick={() => {
          item.onSelect()
          onClose()
        }}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
          'hover:bg-surface-hover active:bg-surface-active disabled:pointer-events-none disabled:opacity-40',
          item.danger ? 'text-danger' : 'text-content-primary'
        )}
      >
        {Icon && <Icon size={18} className={item.danger ? 'text-danger' : 'text-content-secondary'} />}
        <span className="flex-1">{item.label}</span>
      </button>
    </>
  )
}

/**
 * Menú de acciones responsivo:
 *  - Escritorio: dropdown flotante anclado (usar dentro de un contenedor `relative`).
 *  - Móvil (< 768px): bottom sheet deslizable desde abajo.
 */
export function Menu({ open, onClose, items, title, align = 'left', children }: MenuProps) {
  const isMobile = useIsMobile()
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose, open && !isMobile)

  if (!open) return null

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={title}>
        <div role="menu" className="flex flex-col">
          {children}
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onClose={onClose} />
          ))}
        </div>
      </BottomSheet>
    )
  }

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'absolute top-full z-dropdown mt-1 min-w-[220px] animate-scale-in origin-top rounded-xl border border-border bg-surface p-1.5 shadow-menu',
        align === 'right' ? 'right-0' : 'left-0'
      )}
    >
      {children}
      {items.map((item) => (
        <ItemRow key={item.id} item={item} onClose={onClose} />
      ))}
    </div>
  )
}
