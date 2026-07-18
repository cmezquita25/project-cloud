export interface FolderItem {
  type: 'folder'
  id: number
  parent_id: number | null
  name: string
  path: string
  is_starred: boolean
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
