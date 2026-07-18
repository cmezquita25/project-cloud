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
  created_at: string | null
}

export interface AdminStats {
  users: number
  active: number
  admins: number
  used: number
  quota: number
  /** Suma de cuotas asignadas SOLO a usuarios (excluye admins). */
  allocated_users: number
  /** Capacidad real del servidor (definida en la instalación). */
  server_capacity_bytes: number
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
  password: string
  role: 'admin' | 'user'
  quota_bytes: number
  max_upload_bytes: number
}

export type UpdateUserPayload = Partial<{
  email: string
  display_name: string
  role: 'admin' | 'user'
  status: 'active' | 'suspended'
  quota_bytes: number
  max_upload_bytes: number
}>
