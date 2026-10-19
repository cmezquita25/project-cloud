import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  /** Preferencia elegida por el usuario. */
  mode: ThemeMode
  /** Tema efectivo aplicado (resuelve 'system'). */
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  /** Alterna rápido entre claro y oscuro. */
  toggle: () => void
}

const STORAGE_KEY = 'pc-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemPref(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemPref() : mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    return stored ?? 'system'
  })
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolve(mode))

  // Aplica la clase `dark` al <html> y sincroniza el estado resuelto.
  useEffect(() => {
    const applied = resolve(mode)
    setResolved(applied)
    const root = document.documentElement
    root.classList.add('theme-transition')
    root.classList.toggle('dark', applied === 'dark')
    // Retira la clase de transición tras animar para no afectar otras propiedades.
    const t = window.setTimeout(() => root.classList.remove('theme-transition'), 220)
    return () => window.clearTimeout(t)
  }, [mode])

  // Barra de estado del móvil (zona del notch): `theme-color` sigue al fondo real
  // de la app (tema claro/oscuro y estilo de color), no a la preferencia del
  // sistema. Se recalcula tras la transición de colores (220 ms).
  useEffect(() => {
    let t: number | undefined
    const sync = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => {
        const color = getComputedStyle(document.body).backgroundColor
        let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        if (!meta) {
          meta = document.createElement('meta')
          meta.name = 'theme-color'
          document.head.appendChild(meta)
        }
        // Solo el meta: un fondo en <html> haría que el de <body> se pinte como
        // caja propia y tape el fondo de marca (`AppBackdrop`, en z negativo).
        meta.content = color
      }, 250)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme-preset'] })
    return () => {
      observer.disconnect()
      window.clearTimeout(t)
    }
  }, [])

  // Reacciona a cambios del sistema cuando el modo es 'system'.
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const applied = getSystemPref()
      setResolved(applied)
      document.documentElement.classList.toggle('dark', applied === 'dark')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggle = useCallback(() => {
    setMode(resolve(mode) === 'dark' ? 'light' : 'dark')
  }, [mode, setMode])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
