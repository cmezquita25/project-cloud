import { useState, useEffect, useCallback, useMemo } from 'react'
import { Users, HardDrive, Folder, FileText, Trash2, Search, X } from 'lucide-react'
import { Avatar, Spinner, useToast } from '@shared/ui'
import { api } from '@shared/api'
import { cn } from '@shared/lib/cn'

export interface MyShareItem {
  share_id: number
  target_type: 'unit' | 'folder' | 'file'
  target_id: number | null
  item_name: string
  permission_level: 'read' | 'full'
  invited_user: {
    id: number
    display_name: string
    email: string
    avatar_url: string | null
  }
  created_at: string
}

export function SharedItemsBentoCard() {
  const toast = useToast()
  const [items, setItems] = useState<MyShareItem[]>([])
  const [loading, setLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'unit' | 'folder' | 'file'>('all')
  const [search, setSearch] = useState('')

  const fetchMyShares = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ items: MyShareItem[] }>('/shares/my-shares')
      setItems(res.items || [])
    } catch {
      // Ignorar fallo silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMyShares()

    const handler = () => fetchMyShares()
    window.addEventListener('pc:shared-changed', handler)
    return () => window.removeEventListener('pc:shared-changed', handler)
  }, [fetchMyShares])

  const handleUpdatePermission = async (shareId: number, newPerm: 'read' | 'full') => {
    try {
      await api.patch(`/shares/${shareId}`, { permission_level: newPerm })
      toast.success('Permiso actualizado')
      window.dispatchEvent(new CustomEvent('pc:shared-changed'))
      fetchMyShares()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo cambiar el permiso')
    }
  }

  const handleRevoke = async (shareId: number, userName: string) => {
    setRevokingId(shareId)
    try {
      await api.delete(`/shares/${shareId}`)
      toast.success(`Acceso cancelado para ${userName}`)
      setItems((prev) => prev.filter((i) => i.share_id !== shareId))
      window.dispatchEvent(new CustomEvent('pc:shared-changed'))
    } catch (err: any) {
      toast.error(err.message || 'No se pudo revocar el acceso')
    } finally {
      setRevokingId(null)
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== 'all' && item.target_type !== filterType) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchItem = item.item_name.toLowerCase().includes(q)
        const matchUser = item.invited_user.display_name.toLowerCase().includes(q) || item.invited_user.email.toLowerCase().includes(q)
        if (!matchItem && !matchUser) return false
      }
      return true
    })
  }, [items, filterType, search])

  const getItemIcon = (type: 'unit' | 'folder' | 'file') => {
    switch (type) {
      case 'unit':
        return HardDrive
      case 'folder':
        return Folder
      case 'file':
        return FileText
    }
  }

  const getTypeLabel = (type: 'unit' | 'folder' | 'file') => {
    switch (type) {
      case 'unit':
        return 'Unidad'
      case 'folder':
        return 'Carpeta'
      case 'file':
        return 'Archivo'
    }
  }

  const getTypeBadgeClass = (type: 'unit' | 'folder' | 'file') => {
    switch (type) {
      case 'unit':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'folder':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
      case 'file':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
    }
  }

  return (
    <div className="rounded-drive border border-border bg-surface p-6 shadow-sm space-y-4">
      {/* Header Bento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
            <Users size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-content-primary">Elementos compartidos</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-subtle text-primary border border-primary/20">
                {items.length} {items.length === 1 ? 'otorgado' : 'otorgados'}
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-0.5">
              Gestiona los permisos sobre tus carpetas, archivos y unidad completa. Cancela accesos cuando lo requieras.
            </p>
          </div>
        </div>

        {/* Filtros rápidos & Buscador */}
        {items.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
              <input
                type="text"
                placeholder="Buscar compartido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-surface pl-8 pr-7 text-xs text-content-primary placeholder:text-content-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-primary"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-surface-hover/60 p-1 rounded-lg border border-border/60 text-xs">
              {(['all', 'unit', 'folder', 'file'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors capitalize',
                    filterType === t
                      ? 'bg-surface text-primary shadow-xs font-semibold'
                      : 'text-content-secondary hover:text-content-primary'
                  )}
                >
                  {t === 'all' ? 'Todos' : getTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista Bento */}
      {loading ? (
        <div className="flex h-36 items-center justify-center text-content-tertiary">
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-border/80 bg-surface-hover/30">
          <Users size={36} className="text-content-tertiary opacity-40 mb-2" />
          <p className="text-sm font-medium text-content-primary">No has compartido elementos aún</p>
          <p className="text-xs text-content-secondary max-w-sm mt-1">
            Cuando compartas carpetas, archivos o tu unidad completa con miembros de la organización, los verás listados aquí para gestionar o revocar sus permisos.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-content-tertiary">
          No hay elementos compartidos que coincidan con la búsqueda o filtro seleccionado.
        </div>
      ) : (
        <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredItems.map((item) => {
            const Icon = getItemIcon(item.target_type)
            const typeBadge = getTypeBadgeClass(item.target_type)

            return (
              <div
                key={item.share_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 transition-colors hover:bg-surface-hover/40 px-2 rounded-xl"
              >
                {/* 1. Recurso */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', typeBadge)}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-content-primary truncate">
                        {item.item_name}
                      </p>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', typeBadge)}>
                        {getTypeLabel(item.target_type)}
                      </span>
                    </div>
                    <p className="text-xs text-content-tertiary">
                      Compartido el {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* 2. Compartido con (Usuario) */}
                <div className="flex items-center gap-2.5 min-w-[200px] shrink-0">
                  <Avatar src={item.invited_user.avatar_url ?? undefined} name={item.invited_user.display_name} size={32} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-content-primary truncate">
                      {item.invited_user.display_name}
                    </p>
                    <p className="text-[11px] text-content-tertiary truncate">
                      {item.invited_user.email}
                    </p>
                  </div>
                </div>

                {/* 3. Permiso & Acción Cancelar */}
                <div className="flex items-center gap-2 shrink-0 justify-end">
                  <select
                    value={item.permission_level}
                    onChange={(e) => handleUpdatePermission(item.share_id, e.target.value as 'read' | 'full')}
                    className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-content-primary focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                  >
                    <option value="read">Solo lectura</option>
                    <option value="full">Control total</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRevoke(item.share_id, item.invited_user.display_name)}
                    disabled={revokingId === item.share_id}
                    title="Cancelar compartido"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-danger bg-danger-subtle/50 hover:bg-danger-subtle border border-danger/20 hover:border-danger/40 transition-colors disabled:opacity-50"
                  >
                    {revokingId === item.share_id ? (
                      <Spinner size={12} />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
