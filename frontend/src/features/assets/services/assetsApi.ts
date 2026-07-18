import { api, session, ApiError } from '@shared/api'

export interface AssetFolder {
  type: 'folder'
  name: string
  path: string
}

export interface AssetFile {
  type: 'file'
  name: string
  path: string
  size_bytes: number
  mime_type: string | null
  extension: string | null
  url: string
}

export type AssetItem = AssetFolder | AssetFile

export interface AssetsListing {
  path: string
  breadcrumbs: { name: string; path: string }[]
  folders: AssetFolder[]
  files: AssetFile[]
}

export interface AssetsAccess {
  allowed: boolean
  is_admin: boolean
  can_write: boolean
}

export interface AssetPermissionUser {
  id: number
  username: string
  display_name: string
  role: string
  allowed: boolean
}

/** Cliente de la unidad compartida "assets" (Fase 8, punto 6). */
export const assetsApi = {
  access: (signal?: AbortSignal) => api.get<AssetsAccess>('/assets/access', { signal }),

  list: (path: string, signal?: AbortSignal) =>
    api.get<AssetsListing>(`/assets?path=${encodeURIComponent(path)}`, { signal }),

  createFolder: (path: string, name: string) =>
    api.post<AssetFolder>('/assets/folder', { path, name }),

  move: (path: string, target: string) =>
    api.post<{ type: string; name: string; path: string }>('/assets/move', { path, target }),

  remove: (path: string) => api.delete<{ ok: true }>(`/assets?path=${encodeURIComponent(path)}`),

  /** Subida directa (multipart). El tamaño máximo por archivo lo fija el hosting. */
  async upload(path: string, file: File): Promise<AssetFile> {
    const fd = new FormData()
    fd.append('path', path)
    fd.append('file', file)
    const access = session.getAccess()
    const res = await fetch('/api/v1/assets/upload', {
      method: 'POST',
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: fd,
    })
    const env = (await res.json().catch(() => null)) as
      | { success: boolean; data: AssetFile; error?: { code?: string; message?: string } }
      | null
    if (!res.ok || !env?.success) {
      throw new ApiError(
        env?.error?.code ?? 'UPLOAD_ERROR',
        env?.error?.message ?? 'No se pudo subir el archivo',
        res.status
      )
    }
    return env.data
  },

  // --- Administración de permisos ---
  permissions: () => api.get<{ users: AssetPermissionUser[] }>('/admin/assets/permissions'),
  setPermissions: (userIds: number[]) =>
    api.put<{ user_ids: number[] }>('/admin/assets/permissions', { user_ids: userIds }),
}
