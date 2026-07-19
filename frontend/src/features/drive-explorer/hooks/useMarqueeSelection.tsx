import { useEffect, useRef, useState, type RefObject } from 'react'

interface MarqueeOptions {
  /** Contenedor scrolleable donde se dibuja el lazo (debe ser position:relative). */
  containerRef: RefObject<HTMLElement | null>
  /** Snapshot al empezar: `additive` = se mantiene la selección previa (Ctrl/Shift). */
  onBegin: (additive: boolean) => void
  /** Claves de los elementos actualmente dentro del rectángulo. */
  onSelect: (keysInRect: string[], additive: boolean) => void
  disabled?: boolean
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Selección por área ("rubber-band"). Al arrastrar sobre zona vacía dibuja un
 * rectángulo y selecciona los elementos marcados con `data-sel-key` que
 * intersecta. Ignora clics sobre elementos o controles interactivos.
 *
 * Devuelve el overlay a renderizar dentro del contenedor.
 */
export function useMarqueeSelection({ containerRef, onBegin, onSelect, disabled }: MarqueeOptions) {
  const [rect, setRect] = useState<Rect | null>(null)
  // Guardamos callbacks en refs para no re-registrar los listeners en cada render.
  const cbs = useRef({ onBegin, onSelect })
  cbs.current = { onBegin, onSelect }

  useEffect(() => {
    const el = containerRef.current
    if (!el || disabled) return

    let startX = 0
    let startY = 0
    let additive = false
    let active = false

    const intersecting = (box: { left: number; top: number; right: number; bottom: number }): string[] => {
      const keys: string[] = []
      el.querySelectorAll<HTMLElement>('[data-sel-key]').forEach((node) => {
        const r = node.getBoundingClientRect()
        if (r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top) {
          const k = node.dataset.selKey
          if (k) keys.push(k)
        }
      })
      return keys
    }

    const onMove = (e: MouseEvent) => {
      const x = Math.min(startX, e.clientX)
      const y = Math.min(startY, e.clientY)
      const w = Math.abs(e.clientX - startX)
      const h = Math.abs(e.clientY - startY)
      // Umbral: evita iniciar lazo con un clic simple.
      if (!active && w < 5 && h < 5) return
      if (!active) {
        active = true
        document.body.style.userSelect = 'none'
        cbs.current.onBegin(additive)
      }
      setRect({ x, y, w, h })
      cbs.current.onSelect(intersecting({ left: x, top: y, right: x + w, bottom: y + h }), additive)
    }

    const onUp = () => {
      active = false
      setRect(null)
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      // No iniciar sobre un elemento seleccionable ni sobre controles.
      if (target.closest('[data-sel-key], button, a, input, textarea, select, [role="menu"], [data-no-marquee]')) {
        return
      }
      startX = e.clientX
      startY = e.clientY
      additive = e.shiftKey || e.ctrlKey || e.metaKey
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }

    el.addEventListener('mousedown', onDown)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
    }
  }, [containerRef, disabled])

  const overlay = rect ? (
    <div
      aria-hidden
      className="pointer-events-none fixed z-overlay rounded-sm border border-primary bg-primary/15"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    />
  ) : null

  return { overlay, isMarqueeActive: rect !== null }
}
