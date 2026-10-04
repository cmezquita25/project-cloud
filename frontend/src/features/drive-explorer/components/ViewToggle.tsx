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
    <div className="input-glass inline-flex items-center rounded-pill p-0.5">
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
              ? 'bg-gradient-to-r from-gradient-start to-gradient-end text-btn-text shadow-[0_4px_14px_-4px_rgb(var(--glow-a)/0.6)]'
              : 'text-content-secondary hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
          )}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  )
}
