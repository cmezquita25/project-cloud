import { useEffect, type ReactNode } from 'react'
import { cn } from '@shared/lib/cn'
import { Portal } from './Portal'
import { useLockBodyScroll } from './useLockBodyScroll'
import { EXIT_MS, useFrozenWhileClosing, usePresence } from './motion'

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

  // Salida animada: baja deslizando y conserva el último contenido visto.
  const { mounted, closing } = usePresence(open, EXIT_MS.sheet)
  const view = useFrozenWhileClosing({ title, children }, open)

  if (!mounted) return null

  return (
    <Portal>
      <div
        className={cn('fixed inset-0 z-modal flex flex-col justify-end', closing && 'pointer-events-none')}
        role="dialog"
        aria-modal="true"
        aria-hidden={closing || undefined}
      >
        <div
          className={cn(
            'absolute inset-0 bg-overlay/50 backdrop-blur-sm dark:bg-overlay/70',
            closing ? 'animate-fade-out' : 'animate-fade-in'
          )}
          onClick={onClose}
          aria-hidden="true"
        />
        {/* `glass-menu`: el mismo vidrio que los menús de escritorio (tinte
            blanco translúcido sobre base oscura tenue y blur fuerte). */}
        <div
          className={cn(
            'glass-menu relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]',
            closing ? 'animate-slide-down' : 'animate-slide-up',
            className
          )}
        >
          {/* Asa de arrastre, transparente: se integra en el vidrio del panel.
              Darle fondo propio (o desenfoque) pintaba una franja más clara
              arriba, porque se sumaba al fondo del propio panel. */}
          <div className="sticky top-0 z-10 flex justify-center pt-3">
            <span className="h-1 w-9 rounded-full bg-slate-900/20 dark:bg-white/25" />
          </div>
          {view.title && (
            <h2 className="px-4 pb-2 pt-3 text-base font-medium text-content-primary">{view.title}</h2>
          )}
          <div className="px-2 py-2">{view.children}</div>
        </div>
      </div>
    </Portal>
  )
}
