import { useMemo } from 'react'
import { driveApi } from '../services/driveApi'
import type { IExplorerAdapter } from './types'
import type { DriveItem, FolderRef } from '../types'

export function useDriveAdapter(): IExplorerAdapter {
  return useMemo<IExplorerAdapter>(() => ({
    mode: 'drive',
    cacheKey: 'drive',
    capabilities: {
      canWrite: true,
      canStar: true,
      canCopy: true,
      canMove: true,
      canRename: true,
      canDuplicate: true,
      canDownload: true,
      canDelete: true,
      canShare: true,
    },

    loadContents: async (folderId, sort, signal, offset, limit, _q, type, date) => {
      const res = await driveApi.contents(folderId, {
        signal,
        limit,
        offset,
        sort: sort.field,
        order: sort.dir,
        type,
        date,
      })
      return res
    },

    createFolder: async (parentId: FolderRef, name: string) => {
      await driveApi.createFolder(parentId, name)
    },

    renameItem: async (item: DriveItem, name: string) => {
      if (item.type === 'folder') {
        await driveApi.renameFolder(Number(item.id), name)
      } else {
        await driveApi.renameFile(Number(item.id), name)
      }
    },

    moveItems: async (items: DriveItem[], targetId: FolderRef) => {
      for (const it of items) {
        if (it.type === 'folder') {
          await driveApi.moveFolder(Number(it.id), targetId)
        } else {
          await driveApi.moveFile(Number(it.id), targetId)
        }
      }
    },

    copyItems: async (items: DriveItem[], targetId: FolderRef) => {
      for (const it of items) {
        if (it.type === 'folder') {
          await driveApi.copyFolder(Number(it.id), targetId)
        } else {
          await driveApi.copyFile(Number(it.id), targetId)
        }
      }
    },

    deleteItems: async (items: DriveItem[]) => {
      for (const it of items) {
        if (it.type === 'folder') {
          await driveApi.deleteFolder(Number(it.id))
        } else {
          await driveApi.deleteFile(Number(it.id))
        }
      }
    },

    starItem: async (item: DriveItem, starred: boolean) => {
      if (item.type === 'folder') {
        await driveApi.starFolder(Number(item.id), starred)
      } else {
        await driveApi.starFile(Number(item.id), starred)
      }
    },

    duplicateItem: async (item: DriveItem) => {
      if (item.type === 'file') {
        await driveApi.duplicateFile(Number(item.id))
      }
    },

    getDownloadUrl: (item: DriveItem) => {
      if (item.type === 'file') return item.url
      return ''
    }
  }), [])
}
