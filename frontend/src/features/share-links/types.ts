import type { Visibility } from '@features/drive-explorer/types'

export type LinkAccess = 'anyone' | 'members'
export type LinkStatus = 'active' | 'expired' | 'revoked'

/** Enlace compartido tal como lo devuelve /v1/links. */
export interface ShareLink {
  id: number
  token: string
  /** Ruta de la página pública: `/s/{token}`. */
  path: string
  scope: 'drive' | 'org'
  target_type: 'file' | 'folder'
  target_id: number | null
  target_path: string | null
  access: LinkAccess
  label: string | null
  allow_download: boolean
  has_password: boolean
  status: LinkStatus
  /** Segundos hasta que caduca (negativo si ya caducó); null = sin caducidad. */
  expires_in: number | null
  view_count: number
  download_count: number
  /** Segundos desde el último acceso; null = nunca se abrió. */
  accessed_ago: number | null
  created_ago: number
}

/** Destino de un enlace: por id en Mi unidad, por ruta en la unidad compartida. */
export interface LinkTarget {
  scope: 'drive' | 'org'
  target_type: 'file' | 'folder'
  target_id?: number
  target_path?: string
  name: string
}

export interface LinkTargetInfo {
  visibility: Visibility
  /** Elementos privados dentro de una carpeta (también se verán por el enlace). */
  private_items: number
}

export interface LinkInput {
  access?: LinkAccess
  label?: string | null
  allow_download?: boolean
  /** Segundos desde ahora; null = sin caducidad. */
  expires_in?: number | null
  /** Texto = poner o cambiar; null = quitar. */
  password?: string | null
}

/** URL absoluta de un enlace, para copiar y para el QR. */
export const linkUrl = (link: Pick<ShareLink, 'path'>): string => window.location.origin + link.path
