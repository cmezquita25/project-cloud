import { Search, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui'
import { cn } from '@shared/lib/cn'

export type ActivityRange = 'today' | '7d' | '30d' | 'month' | 'all'

export const ACTIVITY_RANGES: { value: ActivityRange; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'all', label: 'Todo' },
]

interface Props {
  range: ActivityRange
  onRangeChange: (range: ActivityRange) => void
  search: string
  onSearchChange: (q: string) => void
  total: number
  onClear: () => void
}

/** Filtros de Auditoría: periodo, búsqueda por usuario y limpieza de registros. */
export function ActivityFilters({ range, onRangeChange, search, onSearchChange, total, onClear }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-900/[0.04] p-1 dark:bg-white/[0.05]" role="radiogroup" aria-label="Periodo">
        {ACTIVITY_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={range === r.value}
            onClick={() => onRangeChange(r.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              range === r.value ? 'bg-surface text-content-primary shadow-sm dark:bg-white/10' : 'text-content-secondary hover:text-content-primary'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <label className="input-glass ring-glow-focus flex min-w-0 flex-1 items-center gap-2 rounded-pill px-3.5 py-2 lg:max-w-xs">
        <Search size={16} className="shrink-0 text-content-tertiary" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por usuario, nombre o correo"
          aria-label="Buscar por usuario"
          className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-tertiary"
        />
      </label>

      <div className="flex items-center gap-3 lg:ml-auto">
        <span className="text-xs text-content-tertiary">{total.toLocaleString()} registros</span>
        <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={onClear} className="text-red-500">
          Limpiar registros
        </Button>
      </div>
    </div>
  )
}
