import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renderiza a un contenedor al final de <body> (overlays, modales, sheets). */
export function Portal({ children }: { children: ReactNode }) {
  const [container] = useState(() => document.createElement('div'))

  useEffect(() => {
    container.setAttribute('data-portal', '')
    document.body.appendChild(container)
    return () => {
      document.body.removeChild(container)
    }
  }, [container])

  return createPortal(children, container)
}
