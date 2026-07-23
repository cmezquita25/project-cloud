import { FileText, Calendar } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Select } from '@shared/ui'

interface SearchFilterBarProps {
  type: string
  date: string
  onChange: (key: string, value: string) => void
}

export function SearchFilterBar({ type, date, onChange }: SearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <Select
        value={type}
        onChange={(val) => onChange('type', String(val))}
        placeholder="Tipo"
        icon={<FileText size={14} className={type ? "text-primary" : "text-content-tertiary"} />}
        className={cn(
          "rounded-pill border font-medium",
          type ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-content-secondary"
        )}
        options={[
          { value: 'document', label: 'Documentos' },
          { value: 'image', label: 'Imágenes' },
          { value: 'video', label: 'Videos' },
          { value: 'audio', label: 'Audio' },
          { value: 'archive', label: 'Comprimidos' },
          { value: 'folder', label: 'Carpetas' },
        ]}
      />

      <Select
        value={date}
        onChange={(val) => onChange('date', String(val))}
        placeholder="Modificado"
        icon={<Calendar size={14} className={date ? "text-primary" : "text-content-tertiary"} />}
        className={cn(
          "rounded-pill border font-medium",
          date ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-content-secondary"
        )}
        options={[
          { value: 'today', label: 'Hoy' },
          { value: '7days', label: 'Últimos 7 días' },
          { value: '30days', label: 'Últimos 30 días' },
        ]}
      />
    </div>
  )
}
