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

export interface RequirementsResult {
  requirements: Requirement[]
  can_proceed: boolean
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
}
