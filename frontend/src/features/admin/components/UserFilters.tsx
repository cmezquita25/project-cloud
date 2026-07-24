import { Calendar, Shield, Activity, Search, X, RotateCcw } from 'lucide-react'
import { Select } from '@shared/ui'
import { cn } from '@shared/lib/cn'

export interface UserFiltersProps {
  dateFrom: string
  onDateFromChange: (val: string) => void
  dateTo: string
  onDateToChange: (val: string) => void
  role: string
  onRoleChange: (val: string) => void
  status: string
  onStatusChange: (val: string) => void
  search: string
  onSearchChange: (val: string) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function UserFilters({
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
  search,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
}: UserFiltersProps) {
  return (
    <div className="rounded-drive border border-border bg-surface p-3.5 sm:p-4 shadow-sm transition-colors">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
        {/* 1. Fechas (Desde & Hasta) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:flex lg:shrink-0 lg:gap-3">
          <div className="flex-1 min-w-[135px]">
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-content-secondary">
              <Calendar size={13} className={dateFrom ? 'text-primary' : 'text-content-tertiary'} />
              <span>Desde</span>
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className={cn(
                'h-10 w-full rounded-drive border px-3 text-sm text-content-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer',
                dateFrom
                  ? 'border-primary bg-primary-subtle/50 font-medium text-primary'
                  : 'border-border bg-surface hover:border-border-strong'
              )}
            />
          </div>

          <div className="flex-1 min-w-[135px]">
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-content-secondary">
              <Calendar size={13} className={dateTo ? 'text-primary' : 'text-content-tertiary'} />
              <span>Hasta</span>
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className={cn(
                'h-10 w-full rounded-drive border px-3 text-sm text-content-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer',
                dateTo
                  ? 'border-primary bg-primary-subtle/50 font-medium text-primary'
                  : 'border-border bg-surface hover:border-border-strong'
              )}
            />
          </div>
        </div>

        {/* 2 & 3. Selects (Rol & Estado) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:flex lg:shrink-0 lg:gap-3">
          {/* Rol */}
          <div className="flex-1 min-w-[135px] lg:w-44">
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-content-secondary">
              <Shield size={13} className={role ? 'text-primary' : 'text-content-tertiary'} />
              <span>Rol</span>
            </label>
            <Select
              value={role}
              onChange={(v) => onRoleChange(String(v))}
              placeholder="Todos"
              icon={<Shield size={15} className={role ? 'text-primary' : 'text-content-tertiary'} />}
              className={cn(
                'h-10 w-full rounded-drive border text-sm font-medium transition-all',
                role
                  ? 'border-primary bg-primary-subtle/50 text-primary hover:border-primary-hover'
                  : 'border-border bg-surface text-content-primary hover:border-border-strong'
              )}
              options={[
                { value: '', label: 'Todos' },
                { value: 'admin', label: 'Administrador' },
                { value: 'user', label: 'Usuario' },
              ]}
            />
          </div>

          {/* Estado */}
          <div className="flex-1 min-w-[135px] lg:w-44">
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-content-secondary">
              <Activity size={13} className={status ? 'text-primary' : 'text-content-tertiary'} />
              <span>Estado</span>
            </label>
            <Select
              value={status}
              onChange={(v) => onStatusChange(String(v))}
              placeholder="Todos"
              icon={<Activity size={15} className={status ? 'text-primary' : 'text-content-tertiary'} />}
              className={cn(
                'h-10 w-full rounded-drive border text-sm font-medium transition-all',
                status
                  ? 'border-primary bg-primary-subtle/50 text-primary hover:border-primary-hover'
                  : 'border-border bg-surface text-content-primary hover:border-border-strong'
              )}
              options={[
                { value: '', label: 'Todos' },
                { value: 'active', label: 'Activo' },
                { value: 'suspended', label: 'Suspendido' },
              ]}
            />
          </div>
        </div>

        {/* 4. Searchbox */}
        <div className="w-full flex-1 lg:min-w-[220px]">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-content-secondary">
            <Search size={13} className={search ? 'text-primary' : 'text-content-tertiary'} />
            <span>Buscar</span>
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Nombre, usuario o email…"
              className={cn(
                'h-10 w-full rounded-drive border pl-9 pr-8 text-sm text-content-primary placeholder:text-content-tertiary transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                search
                  ? 'border-primary bg-surface font-medium'
                  : 'border-border bg-surface hover:border-border-strong'
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-content-tertiary hover:bg-surface-hover hover:text-content-primary transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 5. Limpiar Filtros */}
        {hasActiveFilters && (
          <div className="shrink-0 w-full lg:w-auto">
            <button
              type="button"
              onClick={onClearFilters}
              className="h-10 w-full lg:w-auto flex items-center justify-center gap-1.5 rounded-drive px-3.5 text-xs font-medium text-danger bg-danger-subtle/50 hover:bg-danger-subtle transition-all border border-danger/20 hover:border-danger/40"
            >
              <RotateCcw size={14} />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
