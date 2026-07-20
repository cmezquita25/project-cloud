import { FileText, Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface SearchFilterBarProps {
  type: string
  date: string
  onChange: (key: string, value: string) => void
}

export function SearchFilterBar({ type, date, onChange }: SearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <div className="relative">
        <select
          value={type}
          onChange={(e) => onChange('type', e.target.value)}
          className={cn(
            "appearance-none pl-9 pr-8 py-1.5 rounded-pill border text-sm font-medium transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-focus",
            type ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface hover:bg-surface-hover text-content-secondary"
          )}
        >
          <option value="">Tipo</option>
          <option value="document">Documentos</option>
          <option value="image">Imágenes</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
          <option value="archive">Comprimidos</option>
          <option value="folder">Carpetas</option>
        </select>
        <FileText size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none", type ? "text-primary" : "text-content-tertiary")} />
        <ChevronDown size={14} className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none", type ? "text-primary" : "text-content-tertiary")} />
      </div>

      <div className="relative">
        <select
          value={date}
          onChange={(e) => onChange('date', e.target.value)}
          className={cn(
            "appearance-none pl-9 pr-8 py-1.5 rounded-pill border text-sm font-medium transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-focus",
            date ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface hover:bg-surface-hover text-content-secondary"
          )}
        >
          <option value="">Modificado</option>
          <option value="today">Hoy</option>
          <option value="7days">Últimos 7 días</option>
          <option value="30days">Últimos 30 días</option>
        </select>
        <Calendar size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none", date ? "text-primary" : "text-content-tertiary")} />
        <ChevronDown size={14} className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none", date ? "text-primary" : "text-content-tertiary")} />
      </div>
    </div>
  )
}
