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
  UserPlus,
  LockKeyhole,
  Globe,
} from 'lucide-react'
import type { MenuItem } from '@shared/ui'
import type { DriveItem, ItemAction } from '../types'
import type { ExplorerCapabilities } from '../adapters/types'

/**
 * ¿El usuario es el propietario? Sin datos de propietario (Recientes,
 * Destacados, Búsqueda: solo traen elementos propios) se asume que sí; el
 * servidor lo verifica de todos modos.
 */
function isOwner(item: DriveItem, currentUserId?: number): boolean {
  const ownerId = item.owners?.[0]?.id
  return ownerId === undefined || currentUserId === undefined || ownerId === currentUserId
}

/** Construye los ítems del menú contextual según el tipo de elemento y capacidades. */
export function buildItemMenu(
  item: DriveItem,
  act: (a: ItemAction) => void,
  caps: ExplorerCapabilities,
  currentUserId?: number
): MenuItem[] {
  const isFile = item.type === 'file'
  const isPrivate = item.visibility === 'private'
  // Invitado con la descarga bloqueada: sin descargar, URL, copiar ni duplicar.
  const canDownload = item.my_rights?.download !== false
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

  // Un solo «Compartir»: el diálogo trae las pestañas Personas y Enlace y QR
  // (enlaces solo para quien puede crearlos; los invitados nunca, aunque tengan «full»).
  const canLinks = caps.canCreateLinks && (isOwner(item, currentUserId) || item.my_rights?.share === true)
  if (caps.canShare !== false || canLinks) {
    items.push({ id: 'share', label: 'Compartir', icon: UserPlus, onSelect: () => act('share') })
  }

  const fileDownload = isFile && caps.canDownload && canDownload
  // Los privados no tienen URL pública (se comparten con enlaces o invitaciones).
  if (fileDownload && !isPrivate) {
    items.push({ id: 'copyUrl', label: 'Copiar URL pública', icon: LinkIcon, onSelect: () => act('copyUrl') })
  }

  if (caps.canChangeVisibility && item.visibility !== undefined && isOwner(item, currentUserId) && (!caps.visibilityFoldersOnly || item.type === 'folder')) {
    items.push({
      id: 'visibility',
      label: isPrivate ? 'Hacer público' : 'Hacer privado',
      icon: isPrivate ? Globe : LockKeyhole,
      onSelect: () => act('visibility'),
    })
  }

  if (fileDownload) {
    items.push({ id: 'download', label: 'Descargar', icon: Download, onSelect: () => act('download') })
  }

  if (caps.canRename) {
    items.push({ id: 'rename', label: 'Cambiar nombre', icon: Pencil, onSelect: () => act('rename'), divider: true })
  }
  
  if (caps.canMove) {
    items.push({ id: 'move', label: 'Mover a', icon: FolderInput, onSelect: () => act('move') })
  }
  
  if (caps.canCopy && canDownload) {
    items.push({ id: 'copy', label: 'Copiar a', icon: Copy, onSelect: () => act('copy') })
  }
  
  if (isFile && caps.canDuplicate && canDownload) {
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
