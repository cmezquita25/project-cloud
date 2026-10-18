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
  /** Límite de visitas; null = sin límite. */
  max_views: number | null
  limit_reached: boolean
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
  /** Límite de visitas; null = sin límite. */
  max_views?: number | null
}

/** Políticas de la organización (Configuración → Espacio de trabajo). */
export interface LinkPolicy {
  enabled: boolean
  /** Caducidad máxima en días; 0 = sin límite. */
  max_expiry_days: number
  allow_never: boolean
  allow_anyone: boolean
}

export type PanelStatus = 'active' | 'expiring' | 'expired' | 'revoked' | 'all'

/** Enlace en los paneles «Mis enlaces» y de administración. */
export interface PanelLink extends ShareLink {
  target_name: string | null
  /** ok · trashed (en la papelera) · deleted (borrado definitivamente). */
  target_state: 'ok' | 'trashed' | 'deleted'
  creator_name: string
  creator_username: string
}

export interface LinksPage {
  items: PanelLink[]
  total: number
  counts: Record<PanelStatus, number>
  page: number
  limit: number
  status: PanelStatus
  policy: LinkPolicy
}

export interface LinkHit {
  kind: 'view' | 'download'
  ago: number
  member: string | null
  visitor: string
  user_agent: string | null
}

/** URL absoluta de un enlace, para copiar y para el QR. */
export const linkUrl = (link: Pick<ShareLink, 'path'>): string => window.location.origin + link.path
