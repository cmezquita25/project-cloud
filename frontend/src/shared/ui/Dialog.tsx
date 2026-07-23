import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Portal } from './Portal'
import { IconButton } from './IconButton'
import { useLockBodyScroll } from './useLockBodyScroll'

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

  if (!open) return null

  return (
    <Portal>
      <div
        className="fixed inset-0 z-modal flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 animate-fade-in bg-overlay/50"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={cn(
            'relative z-10 w-full animate-scale-in rounded-2xl bg-surface p-6 shadow-elevation-3',
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
          {title && (
            <h2 className="pr-8 text-xl font-medium text-content-primary">{title}</h2>
          )}
          {description && (
            <p className="mt-2 text-sm text-content-secondary">{description}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}
