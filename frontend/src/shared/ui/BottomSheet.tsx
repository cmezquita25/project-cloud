import { useEffect, type ReactNode } from 'react'
import { cn } from '@shared/lib/cn'
import { Portal } from './Portal'
import { useLockBodyScroll } from './useLockBodyScroll'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Hoja inferior deslizable (móvil). Reemplaza a menús/dropdowns en < 768px:
 * aparece desde abajo hacia arriba, como en Google Drive móvil.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex flex-col justify-end" role="dialog" aria-modal="true">
        <div
          className="absolute inset-0 animate-fade-in bg-overlay/50 backdrop-blur-sm dark:bg-overlay/70"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* `glass-panel`: casi opaco, se abre encima del contenido. */}
        <div
          className={cn(
            'glass-panel relative z-10 max-h-[85vh] animate-slide-up overflow-y-auto rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]',
            className
          )}
        >
          {/* Asa de arrastre. `bg-inherit` toma el mismo fondo del panel para
              que, al quedarse fija arriba, tape lo que pasa por debajo. */}
          <div className="sticky top-0 flex justify-center bg-inherit pt-3">
            <span className="h-1 w-9 rounded-full bg-border-strong" />
          </div>
          {title && (
            <h2 className="px-4 pb-2 pt-3 text-base font-medium text-content-primary">{title}</h2>
          )}
          <div className="px-2 py-2">{children}</div>
        </div>
      </div>
    </Portal>
  )
}
