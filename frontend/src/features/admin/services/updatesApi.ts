import { api } from '@shared/api'

export interface ChangelogEntry {
  type: 'feature' | 'fix' | 'security' | 'change' | string
  text: string
}

export interface AvailableUpdate {
  version: string
  released_at: string | null
  schema: number
  min_from_version: string
  size_bytes: number
  reversible: boolean
  changelog: ChangelogEntry[]
  requirements: { php?: string; extensions?: string[] }
}

export interface PreflightCheck {
  key: string
  label: string
  ok: boolean
  critical: boolean
  detail: string
}

export type UpdateJobStatus = 'running' | 'completed' | 'failed' | 'rolled_back' | 'cancelled' | 'error'

export interface UpdateJob {
  id: string
  status: UpdateJobStatus
  step: string
  progress: number
  from_version: string
  to_version: string
  started_at: string
  updated_at: string | null
  finished_at: string | null
  error: string | null
  warnings: string[]
  log: { at: string; level: 'info' | 'warning' | 'error'; message: string }[]
  cancellable: boolean
  steps: { key: string; label: string }[]
}

export interface OldFilesInfo {
  from_version: string
  to_version: string
  created_at: string
  reversible: boolean
  size_bytes: number
  can_revert: boolean
}

export interface UpdateHistoryEntry {
  id: string
  type: 'update' | 'revert'
  status: UpdateJobStatus
  from_version: string
  to_version: string
  started_at: string
  finished_at: string | null
  error: string | null
}

export interface UpdatesStatus {
  current: { version: string; schema: number; released_at: string | null }
  last_check: string | null
  last_error: string | null
  available: AvailableUpdate | null
  preflight: PreflightCheck[] | null
  job: UpdateJob | null
  old_files: OldFilesInfo | null
  history: UpdateHistoryEntry[]
  last_backup: string | null
}

export interface StepResponse {
  job: UpdateJob
  maintenance_bypass: string | null
  session: { access_token: string; refresh_token: string } | null
}

export const updatesApi = {
  status: () => api.get<UpdatesStatus>('/admin/updates'),
  badge: () => api.get<{ available_version: string | null; running: boolean }>('/admin/updates/badge'),
  check: () => api.post<UpdatesStatus>('/admin/updates/check'),
  start: (version: string, backup: 'system' | 'none') =>
    api.post<{ job: UpdateJob }>('/admin/updates/start', { version, backup, ack: true }),
  step: () => api.post<StepResponse>('/admin/updates/step'),
  cancel: () => api.post<{ job: UpdateJob }>('/admin/updates/cancel'),
  revert: () => api.post<{ reverted_to: string }>('/admin/updates/revert'),
  deleteOldFiles: () => api.delete<{ ok: boolean }>('/admin/updates/old-files'),
}
