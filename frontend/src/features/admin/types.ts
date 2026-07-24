export interface AdminUser {
  id: number
  username: string
  email: string
  display_name: string
  role: 'admin' | 'user'
  status: 'active' | 'suspended'
  quota_bytes: number
  used_bytes: number
  max_upload_bytes: number
  avatar_url?: string | null
  created_at: string | null
}

export interface UsersPage {
  items: AdminUser[]
  total: number
  page: number
  limit: number
}

export interface AdminStats {
  users: number
  active: number
  admins: number
  used: number
  quota: number
  /** Suma de cuotas asignadas SOLO a usuarios (excluye admins). */
  allocated_users: number
  server_capacity_bytes: number
  assets_quota_bytes: number
  assets_used_bytes: number
}

export interface ActivityItem {
  id: number
  action: string
  entity_type: string | null
  entity_id: number | null
  details: unknown
  ip: string | null
  actor: string
  created_at: string
}

export interface ActivityPage {
  items: ActivityItem[]
  total: number
  page: number
  limit: number
}

export interface CreateUserPayload {
  username: string
  email: string
  display_name: string
  /** Requerida salvo que `generate` sea true. */
  password?: string
  /** Si true, el backend genera una contraseña temporal y la envía por correo. */
  generate?: boolean
  role: 'admin' | 'user'
  quota_bytes: number
  max_upload_bytes: number
}

export interface CreateUserResult {
  user: AdminUser
  email_sent: boolean
  /** Contraseña generada, solo si se generó y el correo NO pudo enviarse. */
  generated_password: string | null
}

export type UpdateUserPayload = Partial<{
  email: string
  display_name: string
  role: 'admin' | 'user'
  status: 'active' | 'suspended'
  quota_bytes: number
  max_upload_bytes: number
}>

export type SmtpEncryption = 'tls' | 'ssl' | 'none'

export interface SmtpSettings {
  enabled: boolean
  host: string
  port: number
  user: string
  encryption: SmtpEncryption
  from_email: string
  from_name: string
  /** El backend nunca devuelve la contraseña en claro. */
  has_password: boolean
  /** Máscara (•) si hay contraseña guardada; vacío si no. */
  password: string
}

/** Carga útil para guardar SMTP (incluye la contraseña solo si cambió). */
export type SmtpUpdatePayload = Omit<SmtpSettings, 'has_password'>

export interface EmailTemplate {
  key: string
  label: string
  description: string
  variables: string[]
  subject: string
  body_html: string
}
