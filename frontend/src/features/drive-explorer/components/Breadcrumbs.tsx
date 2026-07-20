import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { Breadcrumb, FolderRef } from '../types'

interface BreadcrumbsProps {
  crumbs: Breadcrumb[]
  onNavigate: (id: FolderRef) => void
  rootLabel?: string
}

/** Migas de pan con navegación. Colapsa rutas largas conservando extremos. */
export function Breadcrumbs({ crumbs, onNavigate, rootLabel = 'Mi unidad' }: BreadcrumbsProps) {
  // Colapsa si hay más de 4 niveles: raíz … penúltimo / último.
  const collapsed = crumbs.length > 4
  const visible = collapsed ? [crumbs[crumbs.length - 2]!, crumbs[crumbs.length - 1]!] : crumbs

  const Crumb = ({ label, id, active }: { label: string; id: FolderRef; active: boolean }) => (
    <button
      type="button"
      onClick={() => !active && onNavigate(id)}
      className={cn(
        'rounded-lg px-2 py-1 text-lg font-normal transition-colors whitespace-nowrap',
        active
          ? 'font-medium text-content-primary'
          : 'text-content-secondary hover:bg-surface-hover'
      )}
    >
      {label}
    </button>
  )

  return (
    <nav className="flex flex-wrap items-center gap-0.5 overflow-hidden" aria-label="Ruta">
      <Crumb label={rootLabel} id="root" active={crumbs.length === 0} />
      {collapsed && (
        <>
          <ChevronRight size={18} className="shrink-0 text-content-tertiary" />
          <span className="px-1 text-content-tertiary">…</span>
        </>
      )}
      {visible.map((c, i) => (
        <Fragment key={c.id}>
          <ChevronRight size={18} className="shrink-0 text-content-tertiary" />
          <Crumb label={c.name} id={c.id} active={i === visible.length - 1} />
        </Fragment>
      ))}
    </nav>
  )
}
