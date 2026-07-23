import { api } from '@shared/api/client'
import { session } from '@shared/api/session'

export interface BackupItem {
  filename: string
  size_bytes: number
  created_at: string
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

  createBackup: async (): Promise<{ filename: string }> => {
    const res = await api.post<{ filename: string }>('/admin/database/backups')
    return res
  },

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
