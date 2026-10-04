import { useEffect } from 'react'

/**
 * Brillo radial que sigue al cursor (portado de la landing). Solo en las
 * pantallas de acceso; en táctil y en móvil lo oculta la propia clase.
 *
 * Va en `-z-10`, detrás del contenido: así la tarjeta glass lo desenfoca en
 * vez de quedar teñida por encima.
 */
export function CursorGlow() {
  useEffect(() => {
    const root = document.documentElement
    const onMove = (e: MouseEvent) => {
      root.style.setProperty('--mx', `${e.clientX}px`)
      root.style.setProperty('--my', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      root.style.removeProperty('--mx')
      root.style.removeProperty('--my')
    }
  }, [])

  return <div aria-hidden="true" className="cursor-glow -z-10" />
}
