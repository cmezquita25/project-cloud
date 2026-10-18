import { api } from '@shared/api'

export interface CronTask {
  key: string
  label: string
  description: string
  interval_seconds: number
  last_run: string | null
  next_run: string | null
  ok: boolean | null
  result: Record<string, number | string | boolean> | null
  error: string | null
  duration_ms: number | null
  mode: 'cli' | 'http' | 'manual' | null
}

export interface CronStatus {
  cron_last_run: string | null
  cron_last_mode: 'cli' | 'http' | null
  server_time: string
  php_version: string
  script_path: string
  panel_path: string | null
  php_binary: string
  command: string
  crontab_line: string
  cron_url: string
  tasks: CronTask[]
}

export interface CronRunResult {
  ok: boolean
  executed_at: string
  skipped?: string
  tasks: Record<string, unknown>
}

export type CronHealth = 'healthy' | 'delayed' | 'stopped' | 'never'

/** Salud del cron según la última ejecución real (con el reloj del servidor). */
export function cronHealth(status: Pick<CronStatus, 'cron_last_run' | 'server_time'>): CronHealth {
  if (!status.cron_last_run) return 'never'
  const age = (new Date(status.server_time).getTime() - new Date(status.cron_last_run).getTime()) / 1000
  if (age < 120) return 'healthy'
  if (age < 3600) return 'delayed'
  return 'stopped'
}

export const cronApi = {
  status: () => api.get<CronStatus>('/admin/cron'),
  runAll: () => api.post<CronRunResult>('/admin/cron/run'),
  runTask: (key: string) => api.post<CronRunResult>(`/admin/cron/tasks/${encodeURIComponent(key)}/run`),
  regenerateSecret: () => api.post<{ cron_url: string }>('/admin/cron/secret'),
}
