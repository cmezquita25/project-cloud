import { api } from '@shared/api'
import type { User } from '@features/auth/types'
import type {
  ActivityPage,
  AdminStats,
  AdminUser,
  CreateUserPayload,
  CreateUserResult,
  EmailTemplate,
  SmtpSettings,
  SmtpUpdatePayload,
  UpdateUserPayload,
} from '../types'

/** Cliente del panel de administración (endpoints /admin/*). */
export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  serverInfo: () => api.get<Record<string, string>>('/admin/server-info'),
  users: () => api.get<{ users: AdminUser[] }>('/admin/users').then((r) => r.users),
  createUser: (payload: CreateUserPayload) => api.post<CreateUserResult>('/admin/users', payload),
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

  // --- Correo saliente (SMTP) ---
  getSmtp: () => api.get<SmtpSettings>('/admin/smtp'),
  updateSmtp: (payload: SmtpUpdatePayload) => api.patch<SmtpSettings>('/admin/smtp', payload),
  /** Prueba la conexión; si `to` viene, envía un correo de prueba a esa dirección. */
  testSmtp: (payload: Partial<SmtpUpdatePayload> & { to?: string }) =>
    api.post<{ ok: true; sent: boolean; message: string }>('/admin/smtp/test', payload),

  // --- Plantillas de correo ---
  getEmailTemplates: () =>
    api.get<{ templates: EmailTemplate[] }>('/admin/email-templates').then((r) => r.templates),
  updateEmailTemplate: (key: string, payload: { subject: string; body_html: string }) =>
    api.patch<{ ok: true }>(`/admin/email-templates/${key}`, payload),
  resetEmailTemplate: (key: string) =>
    api.post<{ ok: true; subject: string; body_html: string }>(`/admin/email-templates/${key}/reset`, {}),
  previewEmailTemplate: (key: string, payload: { subject?: string; body_html?: string }) =>
    api.post<{ subject: string; html: string }>(`/admin/email-templates/${key}/preview`, payload),
}
