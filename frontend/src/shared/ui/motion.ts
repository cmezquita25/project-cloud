import { useEffect, useRef, useState, type RefObject } from 'react'

/** Duraciones de salida (las entradas viven en `tailwind.config.ts`). */
export const EXIT_MS = {
  menu: 140,
  dialog: 160,
  sheet: 200,
} as const

/** `true` si el usuario pidió reducir el movimiento en su sistema. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Mantiene montado un componente el tiempo de su animación de salida.
 *
 * Los menús, diálogos y bottom sheets hacían `if (!open) return null` y
 * desaparecían de golpe. Con esto siguen en pantalla `exitMs` milisegundos
 * con `closing = true` (para pintar la animación de salida) y después se
 * desmontan. La apertura sigue siendo inmediata.
 *
 * Mientras `closing` es `true`, quien lo usa debe dejar de capturar clics
 * (`pointer-events-none`) para que el usuario pueda seguir trabajando sin
 * esperar a que termine la animación.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const delay = prefersReducedMotion() ? 0 : exitMs
    const t = window.setTimeout(() => setMounted(false), delay)
    return () => window.clearTimeout(t)
  }, [open, exitMs])

  return { mounted: open || mounted, closing: !open && mounted }
}

/**
 * Entrada suave (fundido + 8px hacia arriba) de un contenedor cada vez que
 * cambia `key`.
 *
 * Se hace con la Web Animations API y SIN `fill`, a propósito:
 *  - No hay que volver a montar nada (un `key` de React reiniciaría la página
 *    entera y se perdería su estado: selección, scroll, vista).
 *  - Al terminar no queda ningún `transform` aplicado. El contenedor de
 *    páginas envuelve al explorador, cuyo recuadro de selección es `fixed`:
 *    un `transform` residual lo descolocaría. Por lo mismo no se anima
 *    `filter` (crearía igualmente un bloque contenedor y, sobre decenas de
 *    superficies con `backdrop-filter`, sería muy caro).
 */
export function useEntranceOnChange(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return
    const anim = el.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    )
    return () => anim.cancel()
  }, [ref, key])
}

/**
 * Congela un valor mientras el componente se está cerrando.
 *
 * Quien abre un diálogo suele limpiar su estado al cerrarlo (p. ej. la lista
 * de elementos a borrar pasa a `[]`). Durante la animación de salida eso se
 * vería: el título cambiaría a «Eliminar 0 elementos». Con esto se sigue
 * mostrando lo último que se vio abierto.
 */
export function useFrozenWhileClosing<T>(value: T, open: boolean): T {
  const last = useRef(value)
  if (open) last.current = value
  return open ? value : last.current
}
