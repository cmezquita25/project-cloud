import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface HeaderSearchValue {
  /**
   * Indica si el buscador debe mostrarse en el Header (escritorio).
   *  - true  → mostrar en el Header (páginas normales, o Home ya scrolleado).
   *  - false → ocultarlo del Header porque el buscador "hero" está visible en
   *            la página de inicio (Mi unidad).
   */
  showInHeader: boolean
  setShowInHeader: (v: boolean) => void
}

const HeaderSearchContext = createContext<HeaderSearchValue | null>(null)

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  // Por defecto el buscador vive en el Header; la Home lo oculta mientras su
  // buscador "hero" es visible.
  const [showInHeader, setShowInHeader] = useState(true)

  const value = useMemo<HeaderSearchValue>(
    () => ({ showInHeader, setShowInHeader }),
    [showInHeader]
  )

  return <HeaderSearchContext.Provider value={value}>{children}</HeaderSearchContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHeaderSearch(): HeaderSearchValue {
  const ctx = useContext(HeaderSearchContext)
  // Fuera del provider (no debería pasar): comportamiento seguro = mostrar.
  return ctx ?? { showInHeader: true, setShowInHeader: () => {} }
}
