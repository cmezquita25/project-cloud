import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { Breadcrumb, FolderRef } from '../types'

interface BreadcrumbsProps {
  crumbs: Breadcrumb[]
  onNavigate: (id: FolderRef) => void
  rootLabel?: string
}

/**
 * Migas de pan con navegación, siempre en una sola línea.
 * - Escritorio: colapsa rutas largas (> 4 niveles) a raíz … penúltimo / último.
 * - Móvil: la ruta completa se desliza en horizontal y arranca mostrando la
 *   carpeta actual; un degradado en el borde indica que hay más a la izquierda.
 */
export function Breadcrumbs({ crumbs, onNavigate, rootLabel = 'Mi unidad' }: BreadcrumbsProps) {
  const collapsed = crumbs.length > 4
  const scrollerRef = useRef<HTMLElement>(null)
  const [fadeLeft, setFadeLeft] = useState(false)

  // Al cambiar de carpeta, desplaza hasta el final (la carpeta actual).
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
    setFadeLeft(el.scrollLeft > 0)
  }, [crumbs])

  const Crumb = ({ label, id, active, className }: { label: string; id: FolderRef; active: boolean; className?: string }) => (
    <button
      type="button"
      onClick={() => !active && onNavigate(id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-lg px-1.5 py-1 text-base font-normal transition-colors sm:px-2 sm:text-lg',
        active
          ? 'font-semibold text-content-primary'
          : 'text-content-secondary hover:bg-slate-900/[0.05] hover:text-content-primary dark:hover:bg-white/[0.07]',
        className
      )}
    >
      {label}
    </button>
  )

  return (
    <nav
      ref={scrollerRef}
      aria-label="Ruta"
      onScroll={(e) => setFadeLeft(e.currentTarget.scrollLeft > 0)}
      className={cn(
        'flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'max-sm:w-full',
        fadeLeft && '[mask-image:linear-gradient(to_right,transparent,#000_1.5rem)]'
      )}
    >
      <Crumb label={rootLabel} id="root" active={crumbs.length === 0} />
      {collapsed && (
        <span className="hidden shrink-0 items-center sm:flex">
          <ChevronRight size={18} className="shrink-0 text-content-tertiary" />
          <span className="px-1 text-content-tertiary">…</span>
        </span>
      )}
      {crumbs.map((c, i) => {
        // Niveles intermedios: ocultos en escritorio al colapsar, visibles en móvil.
        const hiddenOnDesktop = collapsed && i < crumbs.length - 2
        return (
          <Fragment key={c.id}>
            <ChevronRight size={16} className={cn('shrink-0 text-content-tertiary sm:h-[18px] sm:w-[18px]', hiddenOnDesktop && 'sm:hidden')} />
            <Crumb label={c.name} id={c.id} active={i === crumbs.length - 1} className={cn(hiddenOnDesktop && 'sm:hidden')} />
          </Fragment>
        )
      })}
    </nav>
  )
}
