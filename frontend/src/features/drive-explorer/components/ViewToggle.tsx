import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@shared/lib/cn'

export type ViewMode = 'list' | 'grid'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

/** Alterna entre vista de lista y mosaicos (estilo Google Drive). */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const options: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'list', icon: List, label: 'Vista de lista' },
    { mode: 'grid', icon: LayoutGrid, label: 'Vista de mosaicos' },
  ]
  return (
    <div className="inline-flex items-center rounded-pill border border-border p-0.5">
      {options.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'flex h-8 w-9 items-center justify-center rounded-pill transition-colors',
            value === mode
              ? 'bg-primary-subtle text-primary'
              : 'text-content-secondary hover:bg-surface-hover'
          )}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  )
}
