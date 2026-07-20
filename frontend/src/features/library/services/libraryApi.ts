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
  search: (query: string, filters?: { type?: string; date?: string }, signal?: AbortSignal) => {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    if (filters?.type) p.set('type', filters.type)
    if (filters?.date) p.set('date', filters.date)
    return api.get<SearchResult>(`/search?${p.toString()}`, { signal })
  },
}
