import { Star, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@shared/lib/cn'
import { Checkbox, AvatarGroup } from '@shared/ui'
import { getFileIcon, getFileKindLabel } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatRelative } from '@shared/lib/formatDate'
import { ItemActionsMenu } from './ItemActionsMenu'
import type { DriveItem, FolderItem, ItemAction, ItemInteractions } from '../types'
import type { ExplorerCapabilities } from '../adapters/types'

interface FileListViewProps {
  items: DriveItem[]
  selected: Set<string>
  onOpen: (item: DriveItem) => void
  onSelectToggle: (item: DriveItem) => void
  onAction: (item: DriveItem, action: ItemAction) => void
  interactions?: ItemInteractions
  /** Nombre del propietario a mostrar (null → "Sin definir"). */
  ownerName?: string | null
  /** Muestra la columna "Ubicación" (Recientes/Destacados/Búsqueda). */
  showLocation?: boolean
  capabilities?: ExplorerCapabilities
}

const itemKey = (i: DriveItem) => `${i.type}-${i.id}`

/** Vista de lista (tabla) estilo Drive. */
export function FileListView({
  items,
  selected,
  onOpen,
  onSelectToggle,
  onAction,
  interactions,
  ownerName,
  showLocation = false,
  capabilities,
}: FileListViewProps) {
  return (
    <div className="overflow-hidden rounded-drive border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
            <th className="w-12 py-3 pl-4 pr-2" />
            <th className="w-full px-4 py-3 font-medium">Nombre</th>
            <th className="hidden w-32 whitespace-nowrap px-4 py-3 font-medium md:table-cell">Tipo</th>
            {showLocation && (
              <th className="hidden w-44 whitespace-nowrap px-4 py-3 font-medium lg:table-cell">Ubicación</th>
            )}
            <th className="hidden w-48 whitespace-nowrap px-4 py-3 font-medium lg:table-cell">Propietario</th>
            <th className="hidden w-40 whitespace-nowrap px-4 py-3 font-medium sm:table-cell">Modificado</th>
            <th className="hidden w-28 whitespace-nowrap px-4 py-3 font-medium md:table-cell">Tamaño</th>
            <th className="w-12 py-3 pl-2 pr-4" />
          </tr>
        </thead>
        <motion.tbody
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {items.map((item) => {
            const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')
            const key = itemKey(item)
            const isSelected = selected.has(key)
            const isFolder = item.type === 'folder'
            const isDropTarget = isFolder && interactions?.dropTargetKey === key

            const folderDnd =
              isFolder && interactions
                ? {
                    onDragOver: (e: React.DragEvent) => interactions.onFolderDragOver?.(item as FolderItem, e),
                    onDragLeave: (e: React.DragEvent) => interactions.onFolderDragLeave?.(item as FolderItem, e),
                    onDrop: (e: React.DragEvent) => interactions.onDropOnFolder?.(item as FolderItem, e),
                  }
                : {}

            const owner = item.owner ?? ownerName
            const fallbackOwnerStr = owner && owner.trim() !== '' ? owner : 'Sin definir'
            const hasOwnersArray = Array.isArray(item.owners) && item.owners.length > 0

            return (
              <tr
                key={key}
                data-sel-key={key}
                draggable={interactions?.dragEnabled}
                onDragStart={(e) => interactions?.onItemDragStart?.(item, e)}
                onDragEnd={(e) => interactions?.onItemDragEnd?.(e)}
                onClick={(e) => interactions?.onItemClick?.(item, e)}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(e) => interactions?.onItemContextMenu?.(item, e)}
                {...folderDnd}
                className={cn(
                  'group cursor-pointer border-b border-border/60 last:border-0 transition-colors',
                  isDropTarget
                    ? 'bg-primary-subtle ring-2 ring-inset ring-primary'
                    : isSelected
                      ? 'bg-primary-subtle'
                      : 'hover:bg-surface-hover'
                )}
              >
                <td className="py-3 pl-4 pr-2">
                  <span className={cn('block', isSelected ? '' : 'opacity-0 group-hover:opacity-100')}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onSelectToggle(item)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                </td>
                <td className="w-full max-w-0 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon size={20} className={cn('shrink-0', className)} />
                    <span className="truncate font-medium text-content-primary" title={item.name}>{item.name}</span>
                    {item.is_starred && (
                      <Star size={14} className="shrink-0 fill-warning text-warning" />
                    )}
                    {item.blocked_actions && item.blocked_actions.length > 0 && (
                      <Lock size={14} className="shrink-0 text-danger" />
                    )}
                  </div>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-content-secondary md:table-cell">
                  {getFileKindLabel(item.name, item.type === 'folder')}
                </td>
                {showLocation && (
                  <td className="hidden px-4 py-3 text-content-secondary lg:table-cell">
                    <span className="block max-w-[180px] truncate" title={item.location ?? 'Mi unidad'}>
                      {item.location ?? 'Mi unidad'}
                    </span>
                  </td>
                )}
                <td className="hidden px-4 py-3 text-content-secondary lg:table-cell">
                  {hasOwnersArray ? (
                    <AvatarGroup owners={item.owners} max={3} />
                  ) : (
                    <span className="block max-w-[200px] truncate" title={fallbackOwnerStr}>{fallbackOwnerStr}</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-content-secondary sm:table-cell">
                  {item.updated_at ? formatRelative(item.updated_at) : '—'}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-content-secondary md:table-cell">
                  {item.type === 'file' ? formatBytes(item.size_bytes) : '—'}
                </td>
                <td className="py-3 pl-2 pr-4 text-right">
                  <ItemActionsMenu item={item} onAction={onAction} capabilities={capabilities} />
                </td>
              </tr>
            )
          })}
        </motion.tbody>
      </table>
    </div>
  )
}
