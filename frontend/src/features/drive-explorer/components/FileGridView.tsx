import { Star } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { getFileIcon } from '@shared/lib/fileIcons'
import { ItemActionsMenu } from './ItemActionsMenu'
import type { DriveItem, FileItem, FolderItem, ItemAction, ItemInteractions } from '../types'
import type { ExplorerCapabilities } from '../adapters/types'

interface FileGridViewProps {
  items: DriveItem[]
  selected: Set<string>
  onOpen: (item: DriveItem) => void
  onSelectToggle: (item: DriveItem) => void
  onAction: (item: DriveItem, action: ItemAction) => void
  interactions?: ItemInteractions
  capabilities?: ExplorerCapabilities
}

const itemKey = (i: DriveItem) => `${i.type}-${i.id}`
const isImage = (i: DriveItem): i is FileItem =>
  i.type === 'file' && !!i.mime_type?.startsWith('image/')

/**
 * Vista de mosaicos estilo Google Drive:
 *  - Carpetas: fichas rectangulares compactas, en una fila superior.
 *  - Archivos: tarjetas cuadradas con previsualización, debajo.
 */
export function FileGridView({
  items,
  selected,
  onOpen,
  onAction,
  interactions,
  capabilities,
}: FileGridViewProps) {
  const folders = items.filter((i): i is FolderItem => i.type === 'folder')
  const files = items.filter((i): i is FileItem => i.type === 'file')

  const common = { selected, onOpen, onAction, interactions, capabilities }

  return (
    <div className="space-y-6">
      {folders.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-content-secondary">Carpetas</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((item) => (
              <FolderChip key={itemKey(item)} item={item} {...common} />
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-content-secondary">Archivos</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {files.map((item) => (
              <FileCard key={itemKey(item)} item={item} {...common} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

interface CardProps<T extends DriveItem> {
  item: T
  selected: Set<string>
  onOpen: (item: DriveItem) => void
  onAction: (item: DriveItem, action: ItemAction) => void
  interactions?: ItemInteractions
  capabilities?: ExplorerCapabilities
}

/** Props DOM comunes de interacción (clic con modificadores, menú contextual, arrastre). */
function itemHandlers(item: DriveItem, onOpen: (i: DriveItem) => void, interactions?: ItemInteractions) {
  return {
    draggable: interactions?.dragEnabled,
    onDragStart: (e: React.DragEvent) => interactions?.onItemDragStart?.(item, e),
    onDragEnd: (e: React.DragEvent) => interactions?.onItemDragEnd?.(e),
    onClick: (e: React.MouseEvent) => interactions?.onItemClick?.(item, e),
    onDoubleClick: () => onOpen(item),
    onContextMenu: (e: React.MouseEvent) => interactions?.onItemContextMenu?.(item, e),
  }
}

/** Ficha rectangular de carpeta (fila superior, además destino de soltado). */
function FolderChip({ item, selected, onOpen, onAction, interactions, capabilities }: CardProps<FolderItem>) {
  const { icon: Icon, className } = getFileIcon(item.name, true)
  const key = itemKey(item)
  const isSelected = selected.has(key)
  const isDropTarget = interactions?.dropTargetKey === key

  const dnd = interactions
    ? {
        onDragOver: (e: React.DragEvent) => interactions.onFolderDragOver?.(item, e),
        onDragLeave: (e: React.DragEvent) => interactions.onFolderDragLeave?.(item, e),
        onDrop: (e: React.DragEvent) => interactions.onDropOnFolder?.(item, e),
      }
    : {}

  return (
    <div
      data-sel-key={key}
      {...itemHandlers(item, onOpen, interactions)}
      {...dnd}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors cursor-pointer',
        isDropTarget
          ? 'border-primary bg-primary-subtle ring-2 ring-primary'
          : isSelected
            ? 'border-primary bg-primary-subtle'
            : 'border-border bg-surface hover:bg-surface-hover'
      )}
    >
      <Icon size={22} className={cn('shrink-0', className)} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">{item.name}</span>
      {item.is_starred && <Star size={14} className="shrink-0 fill-warning text-warning" />}
      <div className="flex shrink-0 items-center justify-end p-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
        <ItemActionsMenu item={item} onAction={onAction} capabilities={capabilities} />
      </div>
    </div>
  )
}

/** Tarjeta cuadrada de archivo con previsualización (cuadrícula inferior). */
function FileCard({ item, selected, onOpen, onAction, interactions, capabilities }: CardProps<FileItem>) {
  const { icon: Icon, className } = getFileIcon(item.name, false)
  const isSelected = selected.has(itemKey(item))

  return (
    <div
      data-sel-key={itemKey(item)}
      {...itemHandlers(item, onOpen, interactions)}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border transition-shadow cursor-pointer',
        isSelected
          ? 'border-primary bg-primary-subtle'
          : 'border-border bg-surface hover:shadow-elevation-1'
      )}
    >
      {/* Previsualización cuadrada */}
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-surface-container">
        {isImage(item) ? (
          <img
            src={item.thumbnail_url || `/api/v1/files/${item.id}/thumb?s=400`}
            alt={item.name}
            draggable={false}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Si la miniatura falla, cae al archivo original.
              const img = e.currentTarget
              if (img.src !== item.url) img.src = item.url
            }}
          />
        ) : (
          <Icon size={52} className={cn('opacity-70', className)} strokeWidth={1.5} />
        )}
      </div>

      {/* Pie: icono + nombre + menú */}
      <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
        <Icon size={18} className={cn('shrink-0', className)} />
        <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{item.name}</span>
        {item.is_starred && <Star size={13} className="shrink-0 fill-warning text-warning" />}
        <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
          <ItemActionsMenu item={item} onAction={onAction} capabilities={capabilities} />
        </div>
      </div>
    </div>
  )
}
