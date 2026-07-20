import type { DriveItem, FolderContents, FolderRef } from '../types'
import type { SortState } from '../components/SortControl'

export interface ExplorerCapabilities {
  canWrite: boolean
  canStar: boolean
  canCopy: boolean
  canMove: boolean
  canRename: boolean
  canDuplicate: boolean
  canDownload: boolean
  canDelete: boolean
  canShare: boolean
}

export interface IExplorerAdapter {
  mode: 'drive' | 'assets'
  capabilities: ExplorerCapabilities
  loadContents: (
    folderId: FolderRef,
    sort: SortState,
    signal?: AbortSignal,
    offset?: number,
    limit?: number,
    q?: string,
    type?: string,
    date?: string
  ) => Promise<FolderContents & { has_more?: boolean }>
  
  createFolder: (parentId: FolderRef, name: string) => Promise<void>
  renameItem: (item: DriveItem, name: string) => Promise<void>
  moveItems: (items: DriveItem[], targetId: FolderRef) => Promise<void>
  copyItems: (items: DriveItem[], targetId: FolderRef) => Promise<void>
  deleteItems: (items: DriveItem[]) => Promise<void>
  starItem: (item: DriveItem, starred: boolean) => Promise<void>
  duplicateItem: (item: DriveItem) => Promise<void>
  
  getDownloadUrl: (item: DriveItem) => string
}
