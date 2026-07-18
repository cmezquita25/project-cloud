export interface FolderItem {
  type: 'folder'
  id: number
  parent_id: number | null
  name: string
  path: string
  is_starred: boolean
  deleted_at?: string | null
  created_at: string | null
  updated_at: string | null
}

export interface FileItem {
  type: 'file'
  id: number
  folder_id: number | null
  name: string
  path: string
  size_bytes: number
  mime_type: string | null
  extension: string | null
  is_starred: boolean
  url: string
  deleted_at?: string | null
  created_at: string | null
  updated_at: string | null
}

export type DriveItem = FolderItem | FileItem

export interface Breadcrumb {
  id: number
  name: string
}

export interface FolderContents {
  folder: FolderItem | null
  breadcrumbs: Breadcrumb[]
  folders: FolderItem[]
  files: FileItem[]
}

/** id de carpeta para la API: null/'root' = raíz de la unidad. */
export type FolderRef = number | 'root' | null

export type ItemAction =
  | 'open'
  | 'download'
  | 'copyUrl'
  | 'rename'
  | 'move'
  | 'copy'
  | 'duplicate'
  | 'star'
  | 'details'
  | 'delete'

export type ViewMode = 'list' | 'grid'

/**
 * Interacciones opcionales de los elementos (selección con modificadores, menú
 * contextual y arrastre interno). Las vistas (lista/mosaicos) las aceptan como
 * un solo objeto; si no se pasan, mantienen el comportamiento básico.
 */
export interface ItemInteractions {
  /** Clic simple con modificadores (Ctrl/Cmd para alternar, Shift para rango). */
  onItemClick?: (item: DriveItem, e: React.MouseEvent) => void
  /** Clic derecho sobre un elemento (menú contextual). */
  onItemContextMenu?: (item: DriveItem, e: React.MouseEvent) => void
  /** Habilita arrastrar elementos para moverlos. */
  dragEnabled?: boolean
  onItemDragStart?: (item: DriveItem, e: React.DragEvent) => void
  onItemDragEnd?: (e: React.DragEvent) => void
  /** Soltar sobre una carpeta (mover dentro). */
  onDropOnFolder?: (folder: FolderItem, e: React.DragEvent) => void
  onFolderDragOver?: (folder: FolderItem, e: React.DragEvent) => void
  onFolderDragLeave?: (folder: FolderItem, e: React.DragEvent) => void
  /** Clave (`type-id`) de la carpeta resaltada como destino de soltado. */
  dropTargetKey?: string | null
}
