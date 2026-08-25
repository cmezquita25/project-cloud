import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, HardDrive, AlertTriangle, Info, Clock, History } from 'lucide-react'
import { Portal, Button } from '@shared/ui'
import { notificationsApi, type NotificationItem } from '../services/notificationsApi'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Conteo sin leer para la campana en el header
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000, // Polling cada 30s
  })

  // Lista rápida de las últimas 10 notificaciones cuando el menú está abierto
  const { data: listData, isLoading } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: () => notificationsApi.getNotifications(1, 10),
    enabled: isOpen,
  })

  const unreadCount = countData?.unread_count ?? 0
  const badgeText = unreadCount > 99 ? '+99' : String(unreadCount)

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await notificationsApi.markAsRead(item.id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    setIsOpen(false)
    if (item.target_url) {
      navigate(item.target_url)
    }
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllAsRead()
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  // Calcular posición del menú flotante
  const getMenuPosition = () => {
    if (!buttonRef.current) return { top: 60, right: 16 }
    const rect = buttonRef.current.getBoundingClientRect()
    return {
      top: rect.bottom + 8,
      right: Math.max(16, window.innerWidth - rect.right),
    }
  }

  const pos = getMenuPosition()

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-content-secondary hover:bg-surface-hover hover:text-content-primary transition-colors focus:outline-none"
        title="Notificaciones"
        aria-label="Ver notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] h-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            style={{ top: `${pos.top}px`, right: `${pos.right}px` }}
            className="fixed z-dropdown w-80 sm:w-96 rounded-2xl border border-border bg-surface shadow-elevation-3 overflow-hidden flex flex-col max-h-[520px] animate-fade-in"
          >
            {/* Encabezado del menú flotante */}
            <div className="flex items-center justify-between border-b border-border bg-surface-container/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-content-primary">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <CheckCheck size={14} /> Marcar todas
                </button>
              )}
            </div>

            {/* Lista con scroll (límite 10 elementos) */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-content-tertiary">Cargando notificaciones...</div>
              ) : !listData?.items.length ? (
                <div className="p-8 text-center space-y-2">
                  <Bell size={28} className="mx-auto text-content-tertiary opacity-40" />
                  <p className="text-xs text-content-secondary">No tienes notificaciones por el momento</p>
                </div>
              ) : (
                listData.items.map((item) => {
                  const isUnread = !item.is_read
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                        isUnread ? 'bg-primary-subtle/30 hover:bg-primary-subtle/50' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.type === 'quota_warning' ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                            <AlertTriangle size={16} />
                          </div>
                        ) : item.type === 'item_new_file' ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <HardDrive size={16} />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container text-content-secondary">
                            <Info size={16} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-xs font-semibold truncate ${isUnread ? 'text-primary' : 'text-content-primary'}`}>
                            {item.title}
                          </h4>
                          {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-content-secondary leading-snug line-clamp-2">{item.message}</p>
                        <div className="flex items-center gap-1 text-[10px] text-content-tertiary pt-0.5">
                          <Clock size={11} />
                          <span>{formatTimeAgo(item.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Pie con botón estético hacia el historial */}
            <div className="border-t border-border bg-surface-container/40 p-3">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                leftIcon={History}
                onClick={() => {
                  setIsOpen(false)
                  navigate('/notifications')
                }}
              >
                Consultar historial completo
              </Button>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Hace un momento'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

