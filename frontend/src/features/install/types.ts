export interface InstallStatus {
  installed: boolean
  configured: boolean
}

export interface Requirement {
  key: string
  label: string
  current: string
  ok: boolean
  critical: boolean
}

export interface DiskInfo {
  total_bytes: number | null
  free_bytes: number | null
  path: string
}

export interface RequirementsResult {
  requirements: Requirement[]
  can_proceed: boolean
  disk?: DiskInfo
}

export interface DatabaseForm {
  host: string
  port: number
  name: string
  user: string
  pass: string
}

export interface AdminForm {
  username: string
  email: string
  display_name: string
  password: string
  /** Capacidad real del servidor en bytes (opcional; el backend detecta si falta). */
  server_capacity_bytes?: number
}
