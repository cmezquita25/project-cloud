import { api } from '@shared/api'
import type {
  AdminForm,
  DatabaseForm,
  InstallStatus,
  RequirementsResult,
} from '../types'

/** Llamadas al backend del instalador (endpoints /install/*). */
export const installApi = {
  status: (signal?: AbortSignal) => api.get<InstallStatus>('/install/status', { signal }),

  check: (signal?: AbortSignal) => api.get<RequirementsResult>('/install/check', { signal }),

  saveDatabase: (form: DatabaseForm) => api.post<{ ok: true }>('/install/database', form),

  createAdmin: (form: AdminForm) =>
    api.post<{ ok: true; username: string }>('/install/admin', form),
}
