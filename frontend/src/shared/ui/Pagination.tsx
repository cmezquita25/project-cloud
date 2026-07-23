import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Select } from './Select'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  className?: string
}

export function Pagination({ page, limit, total, onPageChange, onLimitChange, className }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-3 sm:px-6", className)}>
      <div className="flex items-center gap-2 text-sm text-content-secondary">
        <span>Filas por página:</span>
        <Select
          value={limit}
          onChange={(val) => {
            onLimitChange(Number(val))
            onPageChange(1) // Reset to first page
          }}
          className="rounded-md border-transparent bg-surface-hover py-1 px-2 text-content-primary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          options={[
            { value: 10, label: '10' },
            { value: 25, label: '25' },
            { value: 50, label: '50' },
          ]}
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-content-secondary">
          {total > 0 ? `${start} - ${end} de ${total}` : '0 - 0 de 0'}
        </span>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content-primary disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content-primary disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
