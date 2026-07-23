import { useRef, useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@shared/lib/cn'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  side?: Side
  children: ReactNode
  delay?: number
}

/** Tooltip ligero con retraso, activado por hover/focus. Usa React Portal para evitar recortes por overflow. */
export function Tooltip({ content, side = 'bottom', children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timer = useRef<number>()
  const triggerRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    timer.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        let top = 0, left = 0
        if (side === 'top') {
          top = rect.top - 8
          left = rect.left + rect.width / 2
        } else if (side === 'bottom') {
          top = rect.bottom + 8
          left = rect.left + rect.width / 2
        } else if (side === 'left') {
          top = rect.top + rect.height / 2
          left = rect.left - 8
        } else if (side === 'right') {
          top = rect.top + rect.height / 2
          left = rect.right + 8
        }
        setCoords({ top, left })
        setVisible(true)
      }
    }, delay)
  }

  const hide = () => {
    window.clearTimeout(timer.current)
    setVisible(false)
  }

  useEffect(() => {
    if (visible) {
      const handleScroll = () => hide()
      window.addEventListener('scroll', handleScroll, true)
      return () => window.removeEventListener('scroll', handleScroll, true)
    }
  }, [visible])

  const isBrowser = typeof window !== 'undefined'

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex cursor-pointer"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {visible && isBrowser && createPortal(
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none fixed z-[9999] hidden animate-fade-in whitespace-nowrap rounded-md md:block',
            'bg-content-primary px-2 py-1 text-xs font-medium text-content-inverse shadow-elevation-2',
            side === 'top' && '-translate-x-1/2 -translate-y-full',
            side === 'bottom' && '-translate-x-1/2',
            side === 'left' && '-translate-x-full -translate-y-1/2',
            side === 'right' && '-translate-y-1/2'
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
        </span>,
        document.body
      )}
    </>
  )
}
