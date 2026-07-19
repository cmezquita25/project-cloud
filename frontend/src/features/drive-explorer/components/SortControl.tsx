import { useRef, useState } from 'react'
import { ArrowDownAZ, ArrowUpZA, ArrowUpDown, Check } from 'lucide-react'
import { Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { cn } from '@shared/lib/cn'
import type { DriveItem } from '../types'

export type SortField = 'name' | 'owner' | 'updated_at' | 'size'
export type SortDir = 'asc' | 'desc'

export interface SortState {
  field: SortField
  dir: SortDir
}

const STORAGE_KEY = 'pc-sort'

/** Estado de orden persistido en localStorage, compartido por las vistas. */
export function useSortState(): [SortState, (s: SortState) => void] {
  const [state, setState] = useState<SortState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SortState
        if (parsed?.field && parsed?.dir) return parsed
      }
    } catch {
      /* valor por defecto */
    }
    return { field: 'name', dir: 'asc' }
  })
  const set = (s: SortState) => {
    setState(s)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      /* ignora cuota/priv */
    }
  }
  return [state, set]
}

const FIELD_LABEL: Record<SortField, string> = {
  name: 'Nombre',
  owner: 'Propietario',
  updated_at: 'Última modificación',
  size: 'Tamaño',
}

/** Ordena elementos manteniendo las carpetas primero (estilo Drive). */
export function sortDriveItems(items: DriveItem[], { field, dir }: SortState): DriveItem[] {
  const folders = items.filter((i) => i.type === 'folder')
  const files = items.filter((i) => i.type === 'file')

  const cmp = (a: DriveItem, b: DriveItem): number => {
    let r = 0
    switch (field) {
      case 'name':
      case 'owner': // el propietario es uniforme por ahora: desempata por nombre
        r = a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
        break
      case 'updated_at':
        r = (a.updated_at ? Date.parse(a.updated_at) : 0) - (b.updated_at ? Date.parse(b.updated_at) : 0)
        break
      case 'size':
        r = (a.type === 'file' ? a.size_bytes : 0) - (b.type === 'file' ? b.size_bytes : 0)
        break
    }
    if (r === 0) r = a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
    return dir === 'asc' ? r : -r
  }

  return [...folders.sort(cmp), ...files.sort(cmp)]
}

interface SortControlProps {
  value: SortState
  onChange: (next: SortState) => void
  /** Oculta la opción "Propietario" donde no aplica. */
  showOwner?: boolean
}

/** Botón + menú para ordenar (campo) y alternar ASC/DESC (chevron). */
export function SortControl({ value, onChange, showOwner = true }: SortControlProps) {
  const menu = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)

  const fields: SortField[] = showOwner
    ? ['name', 'owner', 'updated_at', 'size']
    : ['name', 'updated_at', 'size']

  const pick = (field: SortField) => {
    // Mismo campo → alterna dirección; nuevo campo → ascendente por defecto.
    if (field === value.field) {
      onChange({ field, dir: value.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      onChange({ field, dir: 'asc' })
    }
  }

  const items: MenuItem[] = fields.map((field) => ({
    id: field,
    label: FIELD_LABEL[field],
    icon: field === value.field ? Check : undefined,
    onSelect: () => pick(field),
  }))

  const DirIcon = value.dir === 'asc' ? ArrowDownAZ : ArrowUpZA

  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        onClick={menu.toggle}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-pill border border-border bg-surface px-3 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-hover'
        )}
        aria-label="Ordenar"
        title={`Ordenar por ${FIELD_LABEL[value.field]} (${value.dir === 'asc' ? 'ascendente' : 'descendente'})`}
      >
        <ArrowUpDown size={15} className="shrink-0" />
        <span className="hidden sm:inline">{FIELD_LABEL[value.field]}</span>
        <DirIcon size={15} className="shrink-0" />
      </button>
      <Menu open={menu.isOpen} onClose={menu.close} items={items} title="Ordenar por" align="right" anchorRef={anchor} />
    </div>
  )
}
