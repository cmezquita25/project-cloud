import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Portal } from './Portal'
import { Spinner } from './Spinner'

interface LoaderContextValue {
  /** Muestra el overlay (con contador: soporta llamadas anidadas). */
  show: (message?: string) => void
  /** Oculta una capa del overlay. */
  hide: () => void
  /** Envuelve una promesa mostrando el overlay mientras se resuelve. */
  wrap: <T>(promise: Promise<T>, message?: string) => Promise<T>
}

const LoaderContext = createContext<LoaderContextValue | null>(null)

/**
 * Overlay de carga global, centrado y con desenfoque sutil, adaptable a tema
 * claro/oscuro (usa tokens semánticos). Reutilizable en toda la plataforma.
 */
export function LoaderProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const active = count > 0

  const show = useCallback((msg?: string) => {
    if (msg !== undefined) setMessage(msg)
    setCount((c) => c + 1)
  }, [])

  const hide = useCallback(() => {
    setCount((c) => Math.max(0, c - 1))
  }, [])

  const wrap = useCallback(
    async <T,>(promise: Promise<T>, msg?: string): Promise<T> => {
      show(msg)
      try {
        return await promise
      } finally {
        hide()
      }
    },
    [show, hide]
  )

  // Limpia el mensaje cuando ya no hay cargas activas.
  useEffect(() => {
    if (count === 0) setMessage(undefined)
  }, [count])

  const value = useMemo<LoaderContextValue>(() => ({ show, hide, wrap }), [show, hide, wrap])

  return (
    <LoaderContext.Provider value={value}>
      {children}
      {active && (
        <Portal>
          <div
            role="status"
            aria-live="polite"
            aria-label={message ?? 'Cargando'}
            className="fixed inset-0 z-toast flex flex-col items-center justify-center gap-4 bg-canvas/70 backdrop-blur-sm animate-fade-in"
          >
            <Spinner size={40} className="text-primary" />
            {message && <p className="text-sm font-medium text-content-secondary">{message}</p>}
          </div>
        </Portal>
      )}
    </LoaderContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoader(): LoaderContextValue {
  const ctx = useContext(LoaderContext)
  if (!ctx) throw new Error('useLoader debe usarse dentro de <LoaderProvider>')
  return ctx
}
