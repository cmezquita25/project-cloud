import { Star } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Checkbox } from '@shared/ui'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatRelative } from '@shared/lib/formatDate'
import { ItemActionsMenu } from './ItemActionsMenu'
import type { DriveItem, ItemAction } from '../types'

interface FileListViewProps {
  items: DriveItem[]
  selected: Set<string>
  onOpen: (item: DriveItem) => void
  onSelectToggle: (item: DriveItem) => void
  onAction: (item: DriveItem, action: ItemAction) => void
}

const itemKey = (i: DriveItem) => `${i.type}-${i.id}`

/** Vista de lista (tabla) estilo Drive. */
export function FileListView({ items, selected, onOpen, onSelectToggle, onAction }: FileListViewProps) {
  return (
    <div className="overflow-hidden rounded-drive border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
            <th className="w-10 py-2 pl-3" />
            <th className="py-2 font-medium">Nombre</th>
            <th className="hidden py-2 font-medium sm:table-cell">Modificado</th>
            <th className="hidden py-2 font-medium md:table-cell">Tamaño</th>
            <th className="w-12 py-2 pr-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')
            const key = itemKey(item)
            const isSelected = selected.has(key)
            return (
              <tr
                key={key}
                onDoubleClick={() => onOpen(item)}
                className={cn(
                  'group cursor-pointer border-b border-border/60 last:border-0 transition-colors',
                  isSelected ? 'bg-primary-subtle' : 'hover:bg-surface-hover'
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
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={cn('shrink-0', className)} />
                    <span className="truncate text-content-primary" onClick={() => onOpen(item)}>
                      {item.name}
                    </span>
                    {item.is_starred && (
                      <Star size={14} className="shrink-0 fill-warning text-warning" />
                    )}
                  </div>
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
