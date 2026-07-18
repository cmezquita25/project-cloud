import { Star } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Checkbox } from '@shared/ui'
import { getFileIcon } from '@shared/lib/fileIcons'
import { ItemActionsMenu } from './ItemActionsMenu'
import type { DriveItem, FileItem, ItemAction } from '../types'

interface FileGridViewProps {
  items: DriveItem[]
  selected: Set<string>
  onOpen: (item: DriveItem) => void
  onSelectToggle: (item: DriveItem) => void
  onAction: (item: DriveItem, action: ItemAction) => void
}

const itemKey = (i: DriveItem) => `${i.type}-${i.id}`
const isImage = (i: DriveItem): i is FileItem =>
  i.type === 'file' && !!i.mime_type?.startsWith('image/')

/** Vista de mosaicos (cards) estilo Drive. */
export function FileGridView({ items, selected, onOpen, onSelectToggle, onAction }: FileGridViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')
        const key = itemKey(item)
        const isSelected = selected.has(key)
        return (
          <div
            key={key}
            onDoubleClick={() => onOpen(item)}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-drive border transition-colors',
              isSelected
                ? 'border-primary bg-primary-subtle'
                : 'border-border bg-surface hover:bg-surface-hover'
            )}
          >
            {/* Cabecera: icono + nombre + menú */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Icon size={20} className={cn('shrink-0', className)} />
              <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{item.name}</span>
              {item.is_starred && <Star size={13} className="shrink-0 fill-warning text-warning" />}
              <ItemActionsMenu item={item} onAction={onAction} />
            </div>

            {/* Previsualización */}
            <div className="mx-3 mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-surface-container">
              {isImage(item) ? (
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Icon size={40} className={cn('opacity-70', className)} strokeWidth={1.5} />
              )}
            </div>

            {/* Checkbox de selección */}
            <span
              className={cn(
                'absolute left-2 top-2',
                isSelected ? '' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => onSelectToggle(item)}
                onClick={(e) => e.stopPropagation()}
              />
            </span>
          </div>
        )
      })}
    </div>
  )
}
