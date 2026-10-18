import { api } from '@shared/api'
import type { Breadcrumb, FileItem, FolderItem } from '@features/drive-explorer/types'

interface PublicFile {
  type: 'file'
  id: string
  name: string
  size_bytes: number
  mime_type: string | null
  extension: string | null
  url: string
  download_url: string | null
  thumbnail_url: string | null
  created_at: string | null
  updated_at: string | null
}

interface PublicFolder {
  type: 'folder'
  id: string
  name: string
  created_at: string | null
  updated_at: string | null
}

export interface PublicLinkInfo {
  /** Llave de paso (contraseña o «solo miembros»); null si no hace falta. */
  key: string | null
  link: {
    target_type: 'file' | 'folder'
    access: 'anyone' | 'members'
    allow_download: boolean
    expires_in: number | null
  }
  name: string
  file?: FileItem
}

export interface PublicFolderPage {
  name: string
  breadcrumbs: Breadcrumb[]
  folders: FolderItem[]
  files: FileItem[]
  has_more: boolean
}

/** Adapta un archivo del enlace al FileItem del explorador (sin ruta ni dueño). */
const toFile = (f: PublicFile): FileItem => ({
  ...f,
  thumbnail_url: f.thumbnail_url ?? undefined,
  folder_id: null,
  path: '',
  is_starred: false,
  public_url: null, // nunca ofrecer «Copiar URL pública» en la vista de un enlace
})

const toFolder = (f: PublicFolder): FolderItem => ({ ...f, parent_id: null, path: '', is_starred: false })

const base = (token: string) => `/public/links/${encodeURIComponent(token)}`

/** Llave de paso guardada en la pestaña (vale ~12 h; evita pedir la contraseña al recargar). */
export const linkKeyStore = {
  get: (token: string): string | null => {
    try {
      return sessionStorage.getItem(`pc-link-key:${token}`)
    } catch {
      return null
    }
  },
  set: (token: string, key: string | null) => {
    try {
      if (key) sessionStorage.setItem(`pc-link-key:${token}`, key)
      else sessionStorage.removeItem(`pc-link-key:${token}`)
    } catch {
      /* sin almacenamiento: se volverá a pedir */
    }
  },
}

const withKey = (params: URLSearchParams, key: string | null) => {
  if (key) params.set('k', key)
  return params.toString() ? `?${params.toString()}` : ''
}

/** Lado del visitante de un enlace /s/{token} (no requiere sesión). */
export const publicLinksApi = {
  open: async (token: string, key: string | null): Promise<PublicLinkInfo> => {
    const res = await api.get<Omit<PublicLinkInfo, 'file'> & { file?: PublicFile }>(base(token) + withKey(new URLSearchParams(), key))
    return { ...res, file: res.file ? toFile(res.file) : undefined }
  },
  unlock: (token: string, password: string) => api.post<{ key: string }>(base(token) + '/unlock', { password }),
  items: async (
    token: string,
    key: string | null,
    opts: { folder?: string; sort: string; order: string; offset: number; limit: number }
  ): Promise<PublicFolderPage> => {
    const params = new URLSearchParams({ sort: opts.sort, order: opts.order, offset: String(opts.offset), limit: String(opts.limit) })
    if (opts.folder) params.set('folder', opts.folder)
    const res = await api.get<{ name: string; breadcrumbs: Breadcrumb[]; folders: PublicFolder[]; files: PublicFile[]; has_more: boolean }>(
      base(token) + '/items' + withKey(params, key)
    )
    return { ...res, folders: res.folders.map(toFolder), files: res.files.map(toFile) }
  },
}
