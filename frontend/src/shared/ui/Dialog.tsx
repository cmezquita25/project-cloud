import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Portal } from './Portal'
import { IconButton } from './IconButton'
import { useLockBodyScroll } from './useLockBodyScroll'
import { EXIT_MS, useFrozenWhileClosing, usePresence } from './motion'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  /** Oculta el botón X (para diálogos que exigen una acción explícita). */
  hideClose?: boolean
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
}

/** Modal centrado estilo Google (escritorio). En móvil preferir BottomSheet. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
}: DialogProps) {
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Salida animada: sigue montado `EXIT_MS.dialog` con el último contenido
  // que se vio abierto (quien lo abre suele limpiar su estado al cerrar).
  const { mounted, closing } = usePresence(open, EXIT_MS.dialog)
  const view = useFrozenWhileClosing({ title, description, children, footer }, open)

  if (!mounted) return null

  return (
    <Portal>
      <div
        className={cn(
          'fixed inset-0 z-modal flex items-center justify-center p-4',
          closing && 'pointer-events-none'
        )}
        role="dialog"
        aria-modal="true"
        aria-hidden={closing || undefined}
      >
        <div
          className={cn(
            'absolute inset-0 bg-overlay/50 backdrop-blur-md dark:bg-overlay/80',
            closing ? 'animate-fade-out' : 'animate-fade-in'
          )}
          onClick={onClose}
          aria-hidden="true"
        />
        {/*
          Panel `glass-strong`, como el modal de la landing. Su contenido no
          debe usar `position: fixed` sin Portal (el desenfoque lo volvería
          relativo al panel); los menús y selects internos ya van en Portal.
        */}
        <div
          className={cn(
            'glass-strong relative z-10 w-full rounded-2xl p-6 ring-1 ring-slate-900/5 dark:ring-white/10',
            closing ? 'animate-scale-out' : 'animate-scale-in',
            SIZES[size]
          )}
        >
          {!hideClose && (
            <IconButton
              icon={X}
              label="Cerrar"
              size="sm"
              onClick={onClose}
              className="absolute right-3 top-3"
            />
          )}
          {view.title && (
            <h2 className="pr-8 text-xl font-semibold text-content-primary">{view.title}</h2>
          )}
          {view.description && (
            <p className="mt-2 text-sm text-content-secondary">{view.description}</p>
          )}
          {view.children && <div className="mt-4">{view.children}</div>}
          {view.footer && <div className="mt-6 flex justify-end gap-2">{view.footer}</div>}
        </div>
      </div>
    </Portal>
  )
}
