import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  HardDrive,
  AlertTriangle,
  Info,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react'
import { Button, Spinner, useToast } from '@shared/ui'
import { notificationsApi, type NotificationItem } from '../services/notificationsApi'

export function NotificationsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page', page, limit, filter],
    queryFn: () => notificationsApi.getNotifications(page, limit, filter === 'unread' ? 'unread' : undefined),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const allSelectedOnPage = items.length > 0 && items.every((item) => selectedIds.includes(item.id))
  const isSomeSelectedOnPage = items.some((item) => selectedIds.includes(item.id)) && !allSelectedOnPage

  const handleToggleSelectAll = () => {
    if (allSelectedOnPage) {
      // Deseleccionar los de esta página
      const pageItemIds = items.map((i) => i.id)
      setSelectedIds((prev) => prev.filter((id) => !pageItemIds.includes(id)))
    } else {
      // Seleccionar todos los de esta página
      const pageItemIds = items.map((i) => i.id)
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageItemIds])))
    }
  }

  const handleToggleItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleItemClick = async (item: NotificationItem, e: React.MouseEvent) => {
    // Si se hace clic directamente sobre la casilla o sus acciones, no navegar
    if ((e.target as HTMLElement).closest('.stop-propagation')) {
      return
    }

    if (!item.is_read) {
      await notificationsApi.markAsRead(item.id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (item.target_url) {
      navigate(item.target_url)
    }
  }

  const handleBulkRead = async () => {
    if (!selectedIds.length) return
    try {
      await notificationsApi.bulkRead(selectedIds)
      toast.success('Notificaciones marcadas como leídas')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar notificaciones')
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.length} notificación(es)?`)) return
    try {
      await notificationsApi.bulkDelete(selectedIds)
      toast.success('Notificaciones eliminadas')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar notificaciones')
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('¿Estás seguro de que deseas vaciar por completo todo tu historial de notificaciones?')) return
    try {
      await notificationsApi.deleteAll()
      toast.success('Historial de notificaciones vaciado')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err: any) {
      toast.error(err?.message || 'Error al vaciar notificaciones')
    }
  }

  const handleDeleteSingle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await notificationsApi.delete(id)
      toast.success('Notificación eliminada')
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar notificación')
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell size={22} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-content-primary">Historial de Notificaciones</h2>
            <p className="text-sm text-content-secondary">
              Gestiona, filtra y limpia las notificaciones de tus recursos compartidos y alertas del sistema.
            </p>
          </div>
        </div>

        {Boolean(total > 0) && (
          <Button variant="danger" size="sm" leftIcon={Trash2} onClick={handleDeleteAll}>
            Vaciar todo el historial
          </Button>
        )}
      </div>

      {/* Barra de Filtros y Acciones Masivas */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-2">
          {/* Pestañas de Filtro */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilter('all')
                setPage(1)
                setSelectedIds([])
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                filter === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-content-secondary hover:text-content-primary'
              }`}
            >
              <Filter size={15} />
              <span>Todas</span>
              {total > 0 && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-content-secondary">
                  {total}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setFilter('unread')
                setPage(1)
                setSelectedIds([])
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                filter === 'unread'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-content-secondary hover:text-content-primary'
              }`}
            >
              <span>No leídas</span>
              {data?.unread_count !== undefined && data.unread_count > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {data.unread_count}
                </span>
              )}
            </button>
          </div>

          {/* Selector de límite por página */}
          <div className="flex items-center gap-2 text-xs text-content-secondary">
            <span>Mostrar:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-content-primary outline-none focus:border-primary"
            >
              <option value={10}>10 por pág.</option>
              <option value={20}>20 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>
          </div>
        </div>

        {/* Acciones Masivas cuando hay elementos seleccionados */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-drive border border-primary/20 bg-primary/5 p-3 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <CheckSquare size={16} />
              <span>{selectedIds.length} notificación(es) seleccionada(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" leftIcon={CheckCheck} onClick={handleBulkRead}>
                Marcar leídas
              </Button>
              <Button variant="danger" size="sm" leftIcon={Trash2} onClick={handleBulkDelete}>
                Eliminar seleccionadas
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabla / Lista de Notificaciones */}
      <div className="rounded-drive border border-border bg-surface shadow-sm overflow-hidden divide-y divide-border">
        {/* Cabecera de Selección */}
        {items.length > 0 && (
          <div className="flex items-center justify-between bg-surface-container/50 px-4 py-2.5 text-xs font-medium text-content-secondary border-b border-border">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-content-secondary hover:text-primary transition-colors"
                title="Seleccionar todas en esta página"
              >
                {allSelectedOnPage ? (
                  <CheckSquare size={18} className="text-primary" />
                ) : isSomeSelectedOnPage ? (
                  <MinusSquare size={18} className="text-primary" />
                ) : (
                  <Square size={18} />
                )}
              </button>
              <span>Seleccionar todas en la página</span>
            </label>
            <span>{items.length} elementos</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner size={28} />
          </div>
        ) : !items.length ? (
          <div className="p-12 text-center space-y-3">
            <Bell size={36} className="mx-auto text-content-tertiary opacity-40" />
            <h3 className="text-base font-medium text-content-primary">No hay notificaciones</h3>
            <p className="text-sm text-content-secondary max-w-sm mx-auto">
              {filter === 'unread'
                ? 'Has leído todas tus notificaciones. ¡Estás al día!'
                : 'Aún no has recibido notificaciones en tu cuenta.'}
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isUnread = !item.is_read
            const isChecked = selectedIds.includes(item.id)

            return (
              <div
                key={item.id}
                onClick={(e) => handleItemClick(item, e)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 transition-colors cursor-pointer ${
                  isChecked
                    ? 'bg-primary-subtle/50'
                    : isUnread
                    ? 'bg-primary-subtle/20 hover:bg-primary-subtle/40'
                    : 'hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Checkbox Individual */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleItem(item.id)
                    }}
                    className="stop-propagation mt-1 text-content-secondary hover:text-primary transition-colors shrink-0"
                  >
                    {isChecked ? (
                      <CheckSquare size={18} className="text-primary" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>

                  <div className="mt-0.5 shrink-0">
                    {item.type === 'quota_warning' ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                        <AlertTriangle size={20} />
                      </div>
                    ) : item.type === 'item_new_file' ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <HardDrive size={20} />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-content-secondary">
                        <Info size={20} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm font-medium ${isUnread ? 'text-primary' : 'text-content-primary'}`}>
                        {item.title}
                      </h4>
                      {isUnread && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          Nueva
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-content-secondary leading-relaxed">{item.message}</p>
                    <div className="flex items-center gap-1.5 text-xs text-content-tertiary pt-0.5">
                      <Clock size={13} />
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Acciones por Fila */}
                <div className="stop-propagation flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSingle(item.id, e)}
                    className="p-1.5 rounded-lg text-content-tertiary hover:bg-danger/10 hover:text-danger transition-colors"
                    title="Eliminar notificación"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Paginación Completa */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <p className="text-xs text-content-secondary">
            Mostrando página <span className="font-medium text-content-primary">{page}</span> de{' '}
            <span className="font-medium text-content-primary">{totalPages}</span> ({total} resultados)
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={ChevronLeft}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={ChevronRight}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
