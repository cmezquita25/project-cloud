export interface User {
  id: number
  username: string
  email: string
  display_name: string
  role: 'admin' | 'user'
  quota_bytes: number
  used_bytes: number
  max_upload_bytes: number
  avatar_url: string | null
  /** Visibilidad de las subidas nuevas (las de carpetas privadas siempre son privadas). */
  default_visibility?: 'public' | 'private'
  created_at: string | null
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface LoginCredentials {
  login: string
  password: string
  remember?: boolean
}
