import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Portal } from './Portal'

export type ToastTone = 'info' | 'success' | 'error' | 'warning'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
}

export interface ToastContextValue {
  toast: (message: string, opts?: { tone?: ToastTone; duration?: number; action?: ToastItem['action'] }) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_CONFIG = {
  success: {
    icon: Check,
    iconBoxClass: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-500/20',
  },
  error: {
    icon: AlertCircle,
    iconBoxClass: 'text-rose-600 bg-rose-100 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-500/20',
  },
  warning: {
    icon: AlertTriangle,
    iconBoxClass: 'text-amber-600 bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-500/20',
  },
  info: {
    icon: Info,
    iconBoxClass: 'text-blue-600 bg-blue-100 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-500/20',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastContextValue['toast']>(
    (message, opts) => {
      const id = ++counter.current
      const item: ToastItem = { id, message, tone: opts?.tone ?? 'info', action: opts?.action }
      setItems((prev) => [...prev, item])
      window.setTimeout(() => dismiss(id), opts?.duration ?? 4000)
    },
    [dismiss]
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m) => toast(m, { tone: 'success' }),
      error: (m) => toast(m, { tone: 'error' }),
      warning: (m) => toast(m, { tone: 'warning' }),
      info: (m) => toast(m, { tone: 'info' }),
    }),
    [toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed right-4 top-16 z-toast flex flex-col items-end gap-3 p-2 sm:right-6">
          <AnimatePresence mode="sync">
            {items.map((t) => {
              const cfg = TONE_CONFIG[t.tone] || TONE_CONFIG.info
              const Icon = cfg.icon

              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 60, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  role="alert"
                  className="pointer-events-auto flex w-full max-w-sm sm:max-w-md items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 text-content-primary shadow-elevation-3 transition-colors dark:border-border"
                >
                  {/* Icon Box */}
                  <div
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm transition-colors',
                      cfg.iconBoxClass
                    )}
                  >
                    <Icon className="h-5 w-5 stroke-[2.2]" />
                    <span className="sr-only">{t.tone} icon</span>
                  </div>

                  {/* Message */}
                  <div className="ms-1 flex-1 text-sm font-normal leading-snug text-content-primary">
                    {t.message}
                  </div>

                  {/* Action Button */}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action?.onClick()
                        dismiss(t.id)
                      }}
                      className="ms-2 shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-subtle hover:underline transition-colors"
                    >
                      {t.action.label}
                    </button>
                  )}

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Descartar"
                    className="ms-auto -mr-1.5 -my-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent p-1.5 text-content-tertiary hover:bg-surface-hover hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
                  >
                    <span className="sr-only">Close</span>
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </Portal>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
