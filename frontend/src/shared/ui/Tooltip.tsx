import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@shared/lib/cn'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  side?: Side
  children: ReactNode
  delay?: number
}

const SIDE_CLASS: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/** Tooltip ligero con retraso, activado por hover/focus. Se oculta en táctil. */
export function Tooltip({ content, side = 'bottom', children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number>()

  const show = () => {
    timer.current = window.setTimeout(() => setVisible(true), delay)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setVisible(false)
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-dropdown hidden animate-fade-in whitespace-nowrap rounded-md md:block',
            'bg-content-primary px-2 py-1 text-xs font-medium text-content-inverse shadow-elevation-2',
            SIDE_CLASS[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
