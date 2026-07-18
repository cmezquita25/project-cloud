import { useEffect } from 'react'

/** Bloquea el scroll del <body> mientras un overlay está abierto. */
export function useLockBodyScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [active])
}
