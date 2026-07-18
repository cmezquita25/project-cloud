import { api } from '@shared/api'
import type { FileItem, FolderItem } from '@features/drive-explorer/types'

export interface StarredResult {
  folders: FolderItem[]
  files: FileItem[]
}

export interface SearchResult {
  query: string
  folders: FolderItem[]
  files: FileItem[]
}

/** Listados derivados de la unidad (Fase 7): recientes, destacados y búsqueda. */
export const libraryApi = {
  recent: (signal?: AbortSignal) =>
    api.get<{ files: FileItem[] }>('/recent', { signal }),
  starred: (signal?: AbortSignal) => api.get<StarredResult>('/starred', { signal }),
  search: (query: string, signal?: AbortSignal) =>
    api.get<SearchResult>(`/search?q=${encodeURIComponent(query)}`, { signal }),
}
