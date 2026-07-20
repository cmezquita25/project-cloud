import { api } from '@shared/api'
import type { FileItem, FolderContents, FolderItem, FolderRef } from '../types'

const ref = (id: FolderRef): string => (id === null || id === undefined ? 'root' : String(id))

/** Cliente del explorador (carpetas y archivos). */
export const driveApi = {
  contents: (folderId: FolderRef, opts?: { signal?: AbortSignal, limit?: number, offset?: number, sort?: string, order?: string, type?: string, date?: string }) => {
    const params = new URLSearchParams()
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
    if (opts?.sort) params.set('sort', opts.sort)
    if (opts?.order) params.set('order', opts.order)
    if (opts?.type) params.set('type', opts.type)
    if (opts?.date) params.set('date', opts.date)
    const qs = params.toString()
    const url = `/folders/${ref(folderId)}/children${qs ? '?' + qs : ''}`
    return api.get<FolderContents>(url, { signal: opts?.signal })
  },

  // --- Carpetas ---
  createFolder: (parentId: FolderRef, name: string) =>
    api.post<FolderItem>('/folders', { parent_id: ref(parentId), name }),
  renameFolder: (id: string | number, name: string) => api.patch<FolderItem>(`/folders/${id}`, { name }),
  moveFolder: (id: string | number, parentId: FolderRef) =>
    api.patch<FolderItem>(`/folders/${id}`, { parent_id: ref(parentId) }),
  starFolder: (id: string | number, is_starred: boolean) =>
    api.patch<FolderItem>(`/folders/${id}`, { is_starred }),
  copyFolder: (id: string | number, targetParentId: FolderRef) =>
    api.post<FolderItem>(`/folders/${id}/copy`, { target_parent_id: ref(targetParentId) }),
  deleteFolder: (id: string | number) => api.delete<{ ok: true }>(`/folders/${id}`),

  // --- Archivos ---
  renameFile: (id: string | number, name: string) => api.patch<FileItem>(`/files/${id}`, { name }),
  moveFile: (id: string | number, folderId: FolderRef) =>
    api.patch<FileItem>(`/files/${id}`, { folder_id: ref(folderId) }),
  starFile: (id: string | number, is_starred: boolean) => api.patch<FileItem>(`/files/${id}`, { is_starred }),
  duplicateFile: (id: string | number) => api.post<FileItem>(`/files/${id}/duplicate`),
  copyFile: (id: string | number, targetFolderId: FolderRef) =>
    api.post<FileItem>(`/files/${id}/copy`, { target_folder_id: ref(targetFolderId) }),
  deleteFile: (id: string | number) => api.delete<{ ok: true }>(`/files/${id}`),
  fileUrl: (id: string | number) => api.get<{ url: string; name: string }>(`/files/${id}/url`),
}
