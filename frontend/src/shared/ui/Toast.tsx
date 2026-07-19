import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Portal } from './Portal'

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toast: (message: string, opts?: { tone?: ToastTone; duration?: number; action?: ToastItem['action'] }) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_ICON = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
}

const TONE_COLOR: Record<ToastTone, string> = {
  info: 'text-primary',
  success: 'text-success',
  error: 'text-danger',
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
    }),
    [toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed right-4 top-[4.5rem] z-toast flex flex-col items-end gap-2">
          {items.map((t) => {
            const Icon = TONE_ICON[t.tone]
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm animate-slide-in-right items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-content-primary shadow-elevation-3"
              >
                <Icon size={20} className={cn('shrink-0', TONE_COLOR[t.tone])} />
                <span className="flex-1 text-sm">{t.message}</span>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick()
                      dismiss(t.id)
                    }}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Descartar"
                  className="shrink-0 rounded-full p-1 text-content-tertiary hover:bg-surface-hover"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}
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
