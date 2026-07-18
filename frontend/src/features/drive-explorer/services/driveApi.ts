import { api } from '@shared/api'
import type { FileItem, FolderContents, FolderItem, FolderRef } from '../types'

const ref = (id: FolderRef): string => (id === null || id === undefined ? 'root' : String(id))

/** Cliente del explorador (carpetas y archivos). */
export const driveApi = {
  contents: (folderId: FolderRef, signal?: AbortSignal) =>
    api.get<FolderContents>(`/folders/${ref(folderId)}/children`, { signal }),

  // --- Carpetas ---
  createFolder: (parentId: FolderRef, name: string) =>
    api.post<FolderItem>('/folders', { parent_id: ref(parentId), name }),
  renameFolder: (id: number, name: string) => api.patch<FolderItem>(`/folders/${id}`, { name }),
  moveFolder: (id: number, parentId: FolderRef) =>
    api.patch<FolderItem>(`/folders/${id}`, { parent_id: ref(parentId) }),
  starFolder: (id: number, is_starred: boolean) =>
    api.patch<FolderItem>(`/folders/${id}`, { is_starred }),
  copyFolder: (id: number, targetParentId: FolderRef) =>
    api.post<FolderItem>(`/folders/${id}/copy`, { target_parent_id: ref(targetParentId) }),
  deleteFolder: (id: number) => api.delete<{ ok: true }>(`/folders/${id}`),

  // --- Archivos ---
  renameFile: (id: number, name: string) => api.patch<FileItem>(`/files/${id}`, { name }),
  moveFile: (id: number, folderId: FolderRef) =>
    api.patch<FileItem>(`/files/${id}`, { folder_id: ref(folderId) }),
  starFile: (id: number, is_starred: boolean) => api.patch<FileItem>(`/files/${id}`, { is_starred }),
  duplicateFile: (id: number) => api.post<FileItem>(`/files/${id}/duplicate`),
  copyFile: (id: number, targetFolderId: FolderRef) =>
    api.post<FileItem>(`/files/${id}/copy`, { target_folder_id: ref(targetFolderId) }),
  deleteFile: (id: number) => api.delete<{ ok: true }>(`/files/${id}`),
  fileUrl: (id: number) => api.get<{ url: string; name: string }>(`/files/${id}/url`),
}
