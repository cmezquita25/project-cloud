import { api } from '@shared/api/client'
import { session } from '@shared/api/session'

export interface BackupItem {
  filename: string
  size_bytes: number
  created_at: string
  /** pre-update / pre-restore = copia del sistema hecha automáticamente antes de actualizar o restaurar. */
  kind?: 'manual' | 'pre-update' | 'pre-restore'
}

export interface RestoreCheck {
  key: string
  level: 'ok' | 'info' | 'warning' | 'error'
  label: string
  detail: string
}

export interface RestoreAnalysis {
  status: 'ok' | 'warning' | 'blocked'
  checks: RestoreCheck[]
  backup: {
    filename: string
    size_bytes: number
    created_at: string
    app_version: string | null
    scope: 'full' | 'system'
    includes: string[] | null
    restore_bytes: number
  }
  defaults: RestoreOptions
}

export interface RestoreOptions {
  restore_config: boolean
  quarantine: boolean
  safety_copy: boolean
}

export interface RestoreJob {
  id: string
  status: 'running' | 'completed' | 'rolled_back' | 'failed' | 'error'
  phase: string
  progress: number
  filename: string
  options: RestoreOptions
  started_at: string
  finished_at: string | null
  safety_file: string | null
  files: number
  files_total: number
  quarantined: number
  quarantine_dir: string | null
  log: { at: string; level: 'info' | 'warning' | 'error'; message: string }[]
  error: string | null
  phases: { key: string; label: string }[]
}

export type BackupSchedule = 'off' | 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface BackupContent {
  users: boolean
  shared: boolean
  trash: boolean
  avatars: boolean
  ext_mode: 'all' | 'only' | 'except'
  extensions: string[]
}

export interface BackupConfig {
  schedule: BackupSchedule
  /** Hora en UTC (la pantalla la muestra en la hora local del navegador). */
  hour_utc: number
  max_copies: number
  scope: 'full' | 'system'
  content: BackupContent
}

export interface BackupEstimate {
  database: number
  users: number
  trash: number
  shared: number
  avatars: number
  total: number
}

export interface BackupJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  trigger: 'manual' | 'scheduled'
  scope: 'full' | 'system'
  started_at: string
  finished_at: string | null
  phase: 'database' | 'files' | 'rotation' | 'done'
  files: number
  bytes: number
  estimate: number
  filename: string | null
  removed: string[]
  error: string | null
}

export interface BackupSettingsPayload {
  settings: BackupConfig
  next_run: string | null
  last_scheduled_run: string | null
  estimate: BackupEstimate
  /** Libre dentro de la capacidad asignada a la plataforma (no el disco físico del servidor). */
  disk_free: number | null
  capacity: {
    free: number | null
    capacity: number
    used: number
    backups: number
    disk_free: number | null
    source: 'capacity' | 'disk'
  }
  job: BackupJob | null
}

export interface ExtensionStat {
  ext: string
  count: number
  bytes: number
}

export const databaseApi = {
  migrate: async (sqlFile: File): Promise<{ statements: number }> => {
    const formData = new FormData()
    formData.append('sql_file', sqlFile)
    const res = await api.post<{ statements: number }>('/admin/database/migrate', formData)
    return res
  },

  migrateAuto: async (): Promise<{ statements: number }> => {
    const res = await api.post<{ statements: number }>('/admin/database/migrate-auto')
    return res
  },

  listBackups: async (): Promise<BackupItem[]> => {
    const res = await api.get<{ backups: BackupItem[] }>('/admin/database/backups')
    return res.backups
  },

  /** Inicia una copia; el servidor responde enseguida y la copia sigue en segundo plano. */
  createBackup: async (): Promise<BackupJob> => {
    const res = await api.post<{ job: BackupJob }>('/admin/database/backups')
    return res.job
  },

  backupSettings: () => api.get<BackupSettingsPayload>('/admin/backups/settings'),
  saveBackupSettings: (settings: BackupConfig) => api.put<BackupSettingsPayload>('/admin/backups/settings', settings),
  estimate: (settings: BackupConfig) =>
    api.post<{ estimate: BackupEstimate; disk_free: number | null }>('/admin/backups/estimate', settings),
  extensions: async (): Promise<ExtensionStat[]> => (await api.get<{ extensions: ExtensionStat[] }>('/admin/backups/extensions')).extensions,
  job: async (): Promise<BackupJob | null> => (await api.get<{ job: BackupJob | null }>('/admin/backups/job')).job,

  /** Diagnóstico previo (no modifica nada). */
  analyzeBackup: (filename: string) =>
    api.post<RestoreAnalysis>(`/admin/database/backups/${encodeURIComponent(filename)}/analyze`),

  /** Activa el mantenimiento y lanza la restauración; el avance se consulta con el token. */
  restoreBackup: (filename: string, options: RestoreOptions) =>
    api.post<{ job: RestoreJob; maintenance_bypass: string; progress_token: string }>(
      `/admin/database/backups/${encodeURIComponent(filename)}/restore`,
      { ...options, ack: true }
    ),

  /** Avance de la restauración. Sin sesión: tras restaurar, las sesiones son las de la copia. */
  restoreProgress: async (token: string, bypass: string | null): Promise<RestoreJob | null> => {
    const headers: Record<string, string> = { 'X-Restore-Token': token }
    if (bypass) headers['X-Maintenance-Bypass'] = bypass
    const res = await fetch('/api/v1/system/restore-progress', { headers, cache: 'no-store' })
    const body = (await res.json().catch(() => null)) as { success: boolean; data?: { job: RestoreJob } } | null
    return res.ok && body?.success && body.data ? body.data.job : null
  },

  deleteBackup: async (filename: string): Promise<void> => {
    await api.delete(`/admin/database/backups/${encodeURIComponent(filename)}`)
  },

  getDownloadUrl: (filename: string): string => {
    const token = session.getAccess() || ''
    return `/api/v1/admin/database/backups/${encodeURIComponent(filename)}/download?token=${token}`
  }
}
