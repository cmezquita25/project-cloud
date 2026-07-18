import { useEffect, useState } from 'react'

/**
 * Devuelve `true` cuando la media query coincide. Reactivo a cambios de tamaño.
 * @example const isMobile = useMediaQuery('(max-width: 767px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Breakpoint estándar del proyecto: móvil = < 768px (md de Tailwind). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
