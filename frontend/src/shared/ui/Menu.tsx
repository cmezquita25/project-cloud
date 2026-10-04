import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { Portal } from './Portal'
import { BottomSheet } from './BottomSheet'
import { EXIT_MS, useFrozenWhileClosing, usePresence } from './motion'

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
  /** Alineación del dropdown en escritorio respecto al ancla. */
  align?: 'left' | 'right'
  /**
   * Elemento de anclaje del dropdown en escritorio. El menú se renderiza en un
   * Portal con posición fija calculada a partir de su rect, de modo que NUNCA
   * lo recorta un contenedor con overflow (tablas, tarjetas, paneles).
   */
  anchorRef?: RefObject<HTMLElement | null>
  /**
   * Coordenadas de viewport para menús contextuales (clic derecho). Tiene
   * prioridad sobre `anchorRef`. El menú se abre junto al cursor.
   */
  position?: { x: number; y: number } | null
  children?: ReactNode
  className?: string
}

function ItemRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const Icon = item.icon
  return (
    <>
      {item.divider && <div className="my-1 h-px bg-slate-900/10 dark:bg-white/10" role="separator" />}
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
          'disabled:pointer-events-none disabled:opacity-40',
          item.danger
            ? 'text-danger hover:bg-danger/10 active:bg-danger/15'
            : 'text-content-primary hover:bg-slate-900/[0.06] active:bg-slate-900/[0.09] dark:hover:bg-white/[0.1] dark:active:bg-white/[0.14]'
        )}
      >
        {Icon && <Icon size={18} className={item.danger ? 'text-danger' : 'text-primary'} />}
        <span className="flex-1">{item.label}</span>
      </button>
    </>
  )
}

/** Calcula una posición `fixed` (anclada a un elemento o a coordenadas), con volteo vertical y límites de viewport. */
function useFloatingStyle(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  position: { x: number; y: number } | null | undefined,
  open: boolean,
  align: 'left' | 'right'
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef?.current
    if (!position && !anchor) return

    const compute = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const next: CSSProperties = { position: 'fixed', visibility: 'visible' }

      if (position) {
        // Menú contextual junto al cursor.
        const openUp = position.y > vh - 300
        next.left = Math.min(position.x, vw - 244)
        if (openUp) {
          next.bottom = vh - position.y
          next.maxHeight = Math.max(120, position.y - 12)
        } else {
          next.top = position.y
          next.maxHeight = Math.max(120, vh - position.y - 12)
        }
        setStyle(next)
        return
      }

      const r = anchor!.getBoundingClientRect()
      const spaceBelow = vh - r.bottom
      const spaceAbove = r.top
      const openUp = spaceBelow < 260 && spaceAbove > spaceBelow

      if (openUp) {
        next.bottom = vh - r.top + 4
        next.maxHeight = Math.max(120, spaceAbove - 12)
      } else {
        next.top = r.bottom + 4
        next.maxHeight = Math.max(120, spaceBelow - 12)
      }
      if (align === 'right') next.right = Math.max(8, vw - r.right)
      else next.left = Math.min(r.left, vw - 240)
      setStyle(next)
    }

    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, anchorRef, position, align])

  return style
}

/**
 * Menú de acciones responsivo:
 *  - Escritorio: dropdown flotante en Portal, anclado a `anchorRef` (o, sin
 *    ancla, posicionado de forma absoluta dentro de un contenedor `relative`).
 *  - Móvil (< 768px): bottom sheet deslizable desde abajo.
 */
export function Menu({ open, onClose, items, title, align = 'left', anchorRef, position, children, className }: MenuProps) {
  const isMobile = useIsMobile()
  const style = useFloatingStyle(anchorRef, position, open && !isMobile, align)
  const menuRef = useRef<HTMLDivElement>(null)

  // Salida animada. Se congela también `position`: en los menús contextuales
  // quien lo abre la pone a `null` al cerrar, y el panel saltaría a la rama
  // de posicionamiento absoluto en mitad de la animación.
  const { mounted, closing } = usePresence(open, isMobile ? EXIT_MS.sheet : EXIT_MS.menu)
  const view = useFrozenWhileClosing({ items, children, title, position }, open)

  if (!mounted) return null

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={view.title}>
        <div role="menu" className="flex flex-col">
          {view.children}
          {view.items.map((item) => (
            <ItemRow key={item.id} item={item} onClose={onClose} />
          ))}
        </div>
      </BottomSheet>
    )
  }

  const content = (
    <>
      {view.children}
      {view.items.map((item) => (
        <ItemRow key={item.id} item={item} onClose={onClose} />
      ))}
    </>
  )

  /*
    `glass-menu`: vidrio con el tinte blanco de la landing sobre una base
    oscura tenue, para abrirse sobre la rejilla de archivos sin dejar leer
    los nombres de debajo (ver index.css). Conserva `rounded-xl`.
  */
  const panelClass = cn(
    'glass-menu min-w-[220px] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl p-1.5',
    closing ? 'pointer-events-none animate-scale-out' : 'animate-scale-in',
    className
  )

  // Sin ancla ni posición: comportamiento clásico (absoluto dentro de un contenedor relativo).
  if (!anchorRef && !view.position) {
    return (
      <div className={cn('absolute top-full z-dropdown mt-1 origin-top', align === 'right' ? 'right-0' : 'left-0')}>
        <div ref={menuRef} role="menu" className={panelClass}>
          {content}
        </div>
      </div>
    )
  }

  // Con ancla o coordenadas: Portal + posición fija (inmune a overflow). El `style`
  // (posición + maxHeight) se aplica al propio panel scrollable, de modo que nunca
  // se corta contra el borde de la pantalla (incluido con zoom): hace scroll.
  return (
    <Portal>
      {/* Capa de cierre: se retira en cuanto empieza la salida, para que el
          siguiente clic llegue a la página sin esperar a la animación. */}
      {!closing && (
        <div
          className="fixed inset-0 z-dropdown"
          onMouseDown={onClose}
          onContextMenu={(e) => {
            e.preventDefault()
            onClose()
          }}
          aria-hidden="true"
        />
      )}
      <div ref={menuRef} role="menu" style={style} className={cn('z-dropdown origin-top', panelClass)}>
        {content}
      </div>
    </Portal>
  )
}
