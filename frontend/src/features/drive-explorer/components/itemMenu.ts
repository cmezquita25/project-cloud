import {
  FolderOpen,
  Download,
  Link as LinkIcon,
  Pencil,
  FolderInput,
  Copy,
  CopyPlus,
  Star,
  StarOff,
  Info,
  Trash2,
} from 'lucide-react'
import type { MenuItem } from '@shared/ui'
import type { DriveItem, ItemAction } from '../types'

/** Construye los ítems del menú contextual según el tipo de elemento. */
export function buildItemMenu(item: DriveItem, act: (a: ItemAction) => void): MenuItem[] {
  const isFile = item.type === 'file'
  const items: MenuItem[] = []

  items.push({
    id: 'open',
    label: isFile ? 'Vista previa' : 'Abrir',
    icon: FolderOpen,
    onSelect: () => act('open'),
  })

  if (isFile) {
    items.push({ id: 'download', label: 'Descargar', icon: Download, onSelect: () => act('download') })
    items.push({ id: 'copyUrl', label: 'Copiar URL pública', icon: LinkIcon, onSelect: () => act('copyUrl') })
  }

  items.push({ id: 'rename', label: 'Cambiar nombre', icon: Pencil, onSelect: () => act('rename'), divider: true })
  items.push({ id: 'move', label: 'Mover a', icon: FolderInput, onSelect: () => act('move') })
  items.push({ id: 'copy', label: 'Copiar a', icon: Copy, onSelect: () => act('copy') })
  if (isFile) {
    items.push({ id: 'duplicate', label: 'Duplicar', icon: CopyPlus, onSelect: () => act('duplicate') })
  }

  items.push({
    id: 'star',
    label: item.is_starred ? 'Quitar de destacados' : 'Destacar',
    icon: item.is_starred ? StarOff : Star,
    onSelect: () => act('star'),
    divider: true,
  })
  items.push({ id: 'details', label: 'Detalles', icon: Info, onSelect: () => act('details') })
  items.push({
    id: 'delete',
    label: 'Eliminar',
    icon: Trash2,
    onSelect: () => act('delete'),
    danger: true,
    divider: true,
  })

  return items
}
