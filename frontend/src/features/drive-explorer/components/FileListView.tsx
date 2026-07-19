import { Star } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Checkbox } from '@shared/ui'
import { getFileIcon, getFileKindLabel } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatRelative } from '@shared/lib/formatDate'
import { ItemActionsMenu } from './ItemActionsMenu'
import type { DriveItem, FolderItem, ItemAction, ItemInteractions } from '../types'

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
}: FileListViewProps) {
  const owner = ownerName && ownerName.trim() !== '' ? ownerName : 'Sin definir'
  return (
    <div className="overflow-hidden rounded-drive border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
            <th className="w-10 py-2 pl-3" />
            <th className="w-full py-2 font-medium">Nombre</th>
            <th className="hidden w-32 py-2 font-medium md:table-cell">Tipo</th>
            {showLocation && (
              <th className="hidden w-40 py-2 font-medium lg:table-cell">Ubicación</th>
            )}
            <th className="hidden w-40 py-2 font-medium lg:table-cell">Propietario</th>
            <th className="hidden w-40 py-2 font-medium sm:table-cell">Modificado</th>
            <th className="hidden w-28 py-2 font-medium md:table-cell">Tamaño</th>
            <th className="w-12 py-2 pr-2" />
          </tr>
        </thead>
        <tbody>
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
                <td className="py-2 pl-3">
                  <span className={cn('block', isSelected ? '' : 'opacity-0 group-hover:opacity-100')}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onSelectToggle(item)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                </td>
                <td className="max-w-0 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon size={20} className={cn('shrink-0', className)} />
                    <span className="truncate text-content-primary">{item.name}</span>
                    {item.is_starred && (
                      <Star size={14} className="shrink-0 fill-warning text-warning" />
                    )}
                  </div>
                </td>
                <td className="hidden py-2 text-content-secondary md:table-cell">
                  {getFileKindLabel(item.name, item.type === 'folder')}
                </td>
                {showLocation && (
                  <td className="hidden max-w-0 py-2 text-content-secondary lg:table-cell">
                    <span className="block truncate">{item.location ?? 'Mi unidad'}</span>
                  </td>
                )}
                <td className="hidden max-w-0 py-2 text-content-secondary lg:table-cell">
                  <span className="block truncate">{owner}</span>
                </td>
                <td className="hidden py-2 text-content-secondary sm:table-cell">
                  {item.updated_at ? formatRelative(item.updated_at) : '—'}
                </td>
                <td className="hidden py-2 text-content-secondary md:table-cell">
                  {item.type === 'file' ? formatBytes(item.size_bytes) : '—'}
                </td>
                <td className="py-2 pr-2 text-right">
                  <ItemActionsMenu item={item} onAction={onAction} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
