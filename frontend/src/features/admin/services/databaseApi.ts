import { api } from '@shared/api/client'
import { session } from '@shared/api/session'

export interface BackupItem {
  filename: string
  size_bytes: number
  created_at: string
  /** pre-update = copia del sistema hecha automáticamente antes de actualizar. */
  kind?: 'manual' | 'pre-update'
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
  disk_free: number | null
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

  restoreBackup: async (filename: string): Promise<void> => {
    await api.post(`/admin/database/backups/${encodeURIComponent(filename)}/restore`)
  },

  deleteBackup: async (filename: string): Promise<void> => {
    await api.delete(`/admin/database/backups/${encodeURIComponent(filename)}`)
  },

  getDownloadUrl: (filename: string): string => {
    const token = session.getAccess() || ''
    return `/api/v1/admin/database/backups/${encodeURIComponent(filename)}/download?token=${token}`
  }
}
