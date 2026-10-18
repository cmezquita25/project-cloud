import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react'
import { Button, IconButton, Portal } from '@shared/ui'
import { useLockBodyScroll } from '@shared/ui/useLockBodyScroll'
import { cn } from '@shared/lib/cn'
import type { WhatsNewRelease } from '../types'

export type WhatsNewMode =
  /** Primera vez: solo se cierra con los botones (más tarde / no volver a mostrar). */
  | 'auto'
  /** Desde «Novedades» del pie de página: solo vuelve a reproducirlas. */
  | 'replay'

interface WhatsNewDialogProps {
  release: WhatsNewRelease
  mode: WhatsNewMode
  /** «Recordármelo después» (auto) o cerrar (replay). */
  onLater: () => void
  /** «No volver a mostrar» / «Entendido». */
  onDismiss: () => void
  /** Botón de una diapositiva que lleva a la función. */
  onAction: (to: string) => void
}

const SWIPE_PX = 60

/**
 * Ventana de novedades: diapositivas con una reproducción visual de cada
 * cambio y su explicación. Genérica: el contenido viene de `releases/`.
 */
export function WhatsNewDialog({ release, mode, onLater, onDismiss, onAction }: WhatsNewDialogProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const panelRef = useRef<HTMLDivElement>(null)
  useLockBodyScroll(true)

  const slides = release.slides
  const slide = slides[index]!
  const isLast = index === slides.length - 1
  const Visual = slide.visual

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= slides.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [index, slides.length]
  )

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
      else if (e.key === 'Escape' && mode === 'replay') onLater()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, index, mode, onLater])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX) go(index + 1)
    else if (info.offset.x > SWIPE_PX) go(index - 1)
  }

  const SlideIcon = slide.icon

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
        <div
          className="absolute inset-0 animate-fade-in bg-overlay/60 backdrop-blur-md dark:bg-overlay/80"
          // Primera vez: no se cierra tocando fuera (hay que elegir una opción).
          onClick={mode === 'replay' ? onLater : undefined}
          aria-hidden="true"
        />

        <motion.div
          ref={panelRef}
          tabIndex={-1}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="glass-strong relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl outline-none ring-1 ring-slate-900/5 dark:ring-white/10"
        >
          {/* Cabecera */}
          <header className="flex items-center gap-3 px-5 pb-3 pt-5 sm:px-7 sm:pt-6">
            <span className="btn-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gradient-start to-gradient-end text-btn-text">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Lo nuevo</p>
              <h2 id="whats-new-title" className="truncate whitespace-nowrap text-[15px] font-semibold leading-snug text-content-primary sm:text-xl">
                {release.title}
              </h2>
            </div>
            <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-slate-900/[0.05] px-2.5 py-1 text-xs font-medium tabular-nums sm:inline text-content-secondary dark:bg-white/[0.07]">
              {index + 1} / {slides.length}
            </span>
            {mode === 'replay' && <IconButton icon={X} label="Cerrar" size="sm" onClick={onLater} className="-mr-1" />}
          </header>

          {/* Cuerpo */}
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 pb-5 sm:px-7 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
            {/* Escenario visual (siempre oscuro, con el halo de la marca) */}
            <motion.div
              className="relative flex min-h-[270px] cursor-grab touch-pan-y items-center justify-center overflow-hidden rounded-2xl bg-[#060914] p-4 ring-1 ring-white/10 active:cursor-grabbing sm:min-h-[300px] sm:p-6 lg:min-h-[340px]"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={onDragEnd}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:28px_28px]" />
              <div className="orb pointer-events-none absolute -left-16 -top-20 h-64 w-64 text-glow-a/35" />
              <div className="orb pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 text-glow-b/30" />
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={slide.id}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: d * 40, filter: 'blur(4px)' }),
                    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
                    exit: (d: number) => ({ opacity: 0, x: d * -40, filter: 'blur(4px)' }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 flex w-full justify-center"
                >
                  <Visual />
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Texto */}
            <div className="flex flex-col justify-center">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                    <SlideIcon size={13} />
                    {slide.badge}
                  </span>
                  <h3 className="text-2xl font-semibold leading-tight text-content-primary sm:text-[1.7rem]">{slide.title}</h3>
                  <p className="text-sm leading-relaxed text-content-secondary sm:text-[15px]">{slide.description}</p>
                  {slide.bullets && (
                    <ul className="space-y-1.5 text-sm text-content-secondary">
                      {slide.bullets.map((b) => (
                        <li key={b} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-gradient-start to-gradient-end" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {slide.footnote && <p className="text-xs text-content-tertiary">{slide.footnote}</p>}
                  {slide.action && (
                    <Button variant="secondary" size="sm" rightIcon={ArrowRight} onClick={() => onAction(slide.action!.to)} className="mt-1">
                      {slide.action.label}
                    </Button>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Pie: progreso y acciones */}
          <footer className="flex flex-col gap-3 border-t border-slate-900/[0.06] px-5 py-4 dark:border-white/[0.08] sm:px-7 lg:flex-row lg:items-center">
            <div className="flex items-center justify-center gap-1.5 lg:justify-start" role="tablist" aria-label="Novedades">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${i + 1}. ${s.title}`}
                  onClick={() => go(i)}
                  className="group flex h-6 items-center"
                >
                  <span
                    className={cn(
                      'block h-2 rounded-full transition-all duration-500 ease-out',
                      i === index
                        ? 'w-7 bg-gradient-to-r from-gradient-start to-gradient-end'
                        : i < index
                          ? 'w-2 bg-primary/50 group-hover:bg-primary/70'
                          : 'w-2 bg-slate-900/15 group-hover:bg-slate-900/30 dark:bg-white/20 dark:group-hover:bg-white/35'
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Móvil: botón principal a lo ancho y descartes lado a lado (textos cortos).
                Tablet: descartes a la izquierda y navegación a la derecha. Escritorio
                (lg): todo en la fila de los puntos. Ningún texto se parte. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 lg:ml-auto lg:justify-end">
              {mode === 'auto' && (
                <div className="order-last grid grid-cols-2 gap-2 sm:order-first sm:flex sm:items-center sm:gap-1">
                  <Button variant="ghost" size="sm" onClick={onLater} className="whitespace-nowrap">
                    <span className="sm:hidden">Más tarde</span>
                    <span className="hidden sm:inline">Recordármelo después</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onDismiss} className="whitespace-nowrap text-content-tertiary">
                    <span className="sm:hidden">No mostrar más</span>
                    <span className="hidden sm:inline">No volver a mostrar</span>
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <IconButton icon={ArrowLeft} label="Anterior" size="sm" onClick={() => go(index - 1)} disabled={index === 0} />
                {isLast ? (
                  <Button size="sm" onClick={mode === 'auto' ? onDismiss : onLater} className="flex-1 whitespace-nowrap sm:min-w-[120px] sm:flex-none">
                    {mode === 'auto' ? '¡Entendido!' : 'Cerrar'}
                  </Button>
                ) : (
                  <Button size="sm" rightIcon={ArrowRight} onClick={() => go(index + 1)} className="flex-1 whitespace-nowrap sm:min-w-[120px] sm:flex-none">
                    Siguiente
                  </Button>
                )}
              </div>
            </div>
          </footer>
          {mode === 'auto' && isLast && (
            <p className="-mt-2 px-5 pb-4 text-center text-[11px] text-content-tertiary sm:px-7 sm:text-right">
              Puedes volver a verlas cuando quieras en «Novedades», al pie de la página.
            </p>
          )}
        </motion.div>
      </div>
    </Portal>
  )
}
