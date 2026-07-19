import { api } from '@shared/api'
import type { User } from '@features/auth/types'
import type {
  ActivityPage,
  AdminStats,
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
} from '../types'

/** Cliente del panel de administración (endpoints /admin/*). */
export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  users: () => api.get<{ users: AdminUser[] }>('/admin/users').then((r) => r.users),
  createUser: (payload: CreateUserPayload) => api.post<AdminUser>('/admin/users', payload),
  updateUser: (id: number, fields: UpdateUserPayload) =>
    api.patch<AdminUser>(`/admin/users/${id}`, fields),
  resetPassword: (id: number, password: string) =>
    api.patch<{ ok: true }>(`/admin/users/${id}/password`, { password }),
  deleteUser: (id: number) => api.delete<{ ok: true }>(`/admin/users/${id}`),
  activity: (page = 1, limit = 30) =>
    api.get<ActivityPage>(`/admin/activity?page=${page}&limit=${limit}`),
  updateCapacity: (bytes: number) =>
    api.patch<{ server_capacity_bytes: number; user: User | null }>('/admin/settings', {
      server_capacity_bytes: bytes,
    }),
  updateSettings: (payload: Record<string, string | number | boolean>) =>
    api.patch<{ server_capacity_bytes?: number; user?: User | null }>('/admin/settings', payload),
  /** Sube un logo (favicon, white, dark, mobile) */
  uploadLogo(type: 'favicon' | 'white' | 'dark' | 'mobile', file: File): Promise<{ ok: true; filename: string }> {
    const formData = new FormData()
    formData.append('type', type)
    formData.append('file', file)
    return api.post<{ ok: true; filename: string }>('/admin/settings/logo', formData)
  },
}
