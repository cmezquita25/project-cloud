import { useMemo } from 'react'
import { assetsApi } from '@features/assets/services/assetsApi'
import type { IExplorerAdapter } from './types'
import type { DriveItem, FileItem, FolderItem, FolderRef } from '../types'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'

function toDriveFile(f: any): FileItem {
  return {
    type: 'file',
    id: f.path,
    folder_id: null,
    name: f.name,
    path: f.path,
    size_bytes: f.size_bytes,
    mime_type: f.mime_type,
    extension: f.extension,
    is_starred: false,
    url: f.url,
    thumbnail_url: f.mime_type?.startsWith('image/') ? `/api/v1/assets/thumb?path=${encodeURIComponent(f.path)}` : undefined,
    created_at: null,
    updated_at: null,
    owner: f.owner,
    owners: f.owners,
    blocked_actions: f.blocked_actions,
  }
}

function toDriveFolder(f: any): FolderItem {
  return {
    type: 'folder',
    id: f.path,
    parent_id: null,
    name: f.name,
    path: f.path,
    is_starred: false,
    created_at: null,
    updated_at: null,
    owner: f.owner,
    owners: f.owners,
    blocked_actions: f.blocked_actions,
  }
}

export function useAssetsAdapter(): IExplorerAdapter {
  const { access } = useAssetsAccess()
  const canWrite = access?.can_write ?? false

  return useMemo<IExplorerAdapter>(() => ({
    mode: 'assets',
    cacheKey: access?.folder_name ? `assets-${access.folder_name}` : 'assets',
    capabilities: {
      canWrite,
      canStar: false,
      canCopy: false,
      canMove: canWrite,
      canRename: canWrite,
      canDuplicate: false,
      canDownload: true,
      canDelete: canWrite,
      canShare: false,
      canBlockActions: access?.is_admin ?? false,
    },

    loadContents: async (folderId, sort, signal, offset, limit, q, type, date) => {
      const res = await assetsApi.list(folderId === 'root' ? '' : String(folderId), {
        signal,
        offset,
        limit,
        sort: sort.field,
        order: sort.dir,
        q,
        type,
        date,
        folder_name: access?.folder_name
      })

      return {
        folder: null,
        breadcrumbs: res.breadcrumbs.map((b) => ({ id: b.path, name: b.name })),
        folders: res.folders.map(toDriveFolder),
        files: res.files.map(toDriveFile),
        has_more: res.has_more
      }
    },

    createFolder: async (parentId: FolderRef, name: string) => {
      const parentPath = (parentId === 'root' || parentId === null) ? '' : String(parentId)
      await assetsApi.createFolder(parentPath, name)
    },

    renameItem: async (item: DriveItem, newName: string) => {
      await assetsApi.rename(String(item.id), newName)
    },

    moveItems: async (items: DriveItem[], targetId: FolderRef) => {
      const targetPath = (targetId === 'root' || targetId === null) ? '' : String(targetId)
      for (const it of items) {
        await assetsApi.move(String(it.id), targetPath)
      }
    },

    copyItems: async () => {
      throw new Error('Not supported in Assets')
    },

    deleteItems: async (items: DriveItem[]) => {
      for (const it of items) {
        await assetsApi.remove(String(it.id))
      }
    },

    restoreItem: async (item: DriveItem) => {
      await assetsApi.restore(String(item.id))
    },

    starItem: async () => {
      throw new Error('Not supported in Assets')
    },

    duplicateItem: async () => {
      throw new Error('Not supported in Assets')
    },

    getDownloadUrl: (item: DriveItem) => {
      if (item.type === 'file') return item.url
      return ''
    }
  }), [canWrite, access?.folder_name])
}
