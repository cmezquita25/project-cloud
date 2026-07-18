import { api } from '@shared/api'
import type { FileItem, FolderItem } from '@features/drive-explorer/types'

export interface TrashContents {
  folders: FolderItem[]
  files: FileItem[]
  retention_days: number
}

/** Cliente de la papelera (Fase 7). */
export const trashApi = {
  list: (signal?: AbortSignal) => api.get<TrashContents>('/trash', { signal }),
  restoreFile: (id: number) => api.post<FileItem>(`/trash/files/${id}/restore`),
  restoreFolder: (id: number) => api.post<FolderItem>(`/trash/folders/${id}/restore`),
  purgeFile: (id: number) => api.delete<{ ok: true }>(`/trash/files/${id}`),
  purgeFolder: (id: number) => api.delete<{ ok: true }>(`/trash/folders/${id}`),
  empty: () => api.delete<{ ok: true; purged: number }>('/trash'),
}
