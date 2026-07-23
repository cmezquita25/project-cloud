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
  Lock,
  Undo2,
} from 'lucide-react'
import type { MenuItem } from '@shared/ui'
import type { DriveItem, ItemAction } from '../types'
import type { ExplorerCapabilities } from '../adapters/types'

/** Construye los ítems del menú contextual según el tipo de elemento y capacidades. */
export function buildItemMenu(item: DriveItem, act: (a: ItemAction) => void, caps: ExplorerCapabilities): MenuItem[] {
  const isFile = item.type === 'file'
  const items: MenuItem[] = []

  const isTrash = item.path.startsWith('.trash/')
  
  if (isTrash) {
    items.push({
      id: 'restore',
      label: 'Restaurar',
      icon: Undo2,
      onSelect: () => act('restore'),
    })
    
    if (caps.canDelete) {
      items.push({
        id: 'delete',
        label: 'Eliminar definitivamente',
        icon: Trash2,
        onSelect: () => act('delete'),
        danger: true,
        divider: true,
      })
    }
    return items
  }

  items.push({
    id: 'open',
    label: isFile ? 'Vista previa' : 'Abrir',
    icon: FolderOpen,
    onSelect: () => act('open'),
  })

  if (isFile) {
    if (caps.canDownload) {
      items.push({ id: 'download', label: 'Descargar', icon: Download, onSelect: () => act('download') })
      items.push({ id: 'copyUrl', label: 'Copiar URL pública', icon: LinkIcon, onSelect: () => act('copyUrl') })
    }
  }

  if (caps.canRename) {
    items.push({ id: 'rename', label: 'Cambiar nombre', icon: Pencil, onSelect: () => act('rename'), divider: true })
  }
  
  if (caps.canMove) {
    items.push({ id: 'move', label: 'Mover a', icon: FolderInput, onSelect: () => act('move') })
  }
  
  if (caps.canCopy) {
    items.push({ id: 'copy', label: 'Copiar a', icon: Copy, onSelect: () => act('copy') })
  }
  
  if (isFile && caps.canDuplicate) {
    items.push({ id: 'duplicate', label: 'Duplicar', icon: CopyPlus, onSelect: () => act('duplicate') })
  }

  if (caps.canStar) {
    items.push({
      id: 'star',
      label: item.is_starred ? 'Quitar de destacados' : 'Destacar',
      icon: item.is_starred ? StarOff : Star,
      onSelect: () => act('star'),
      divider: true,
    })
  }

  items.push({ id: 'details', label: 'Detalles', icon: Info, onSelect: () => act('details') })

  if (caps.canBlockActions) {
    items.push({
      id: 'block',
      label: 'Bloquear acciones',
      icon: Lock,
      onSelect: () => act('block'),
      divider: true,
    })
  }

  if (caps.canDelete) {
    items.push({
      id: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      onSelect: () => act('delete'),
      danger: true,
      divider: true,
    })
  }

  return items
}
