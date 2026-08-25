import { api } from '@shared/api'

export interface NotificationItem {
  id: number
  user_id: number
  actor_id: number | null
  type: string
  title: string
  message: string
  target_url: string | null
  is_read: number
  read_at: string | null
  created_at: string
  actor_username?: string | null
  actor_display_name?: string | null
}

export interface NotificationsListResponse {
  items: NotificationItem[]
  total: number
  unread_count: number
}

export const notificationsApi = {
  getNotifications: async (page = 1, limit = 20, filter?: 'unread' | 'all') => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (filter) params.append('filter', filter)
    return api.get<NotificationsListResponse>(`/notifications?${params.toString()}`)
  },

  getUnreadCount: async () => {
    return api.get<{ unread_count: number }>('/notifications/unread-count')
  },

  markAsRead: async (id: number) => {
    return api.patch<{ ok: boolean; id: number }>(`/notifications/${id}/read`)
  },

  markAllAsRead: async () => {
    return api.post<{ ok: boolean; updated: number }>('/notifications/read-all')
  },

  bulkRead: async (ids: number[]) => {
    return api.post<{ ok: boolean; updated: number }>('/notifications/bulk-read', { ids })
  },

  delete: async (id: number) => {
    return api.delete<{ ok: boolean; id: number }>(`/notifications/${id}`)
  },

  bulkDelete: async (ids: number[]) => {
    return api.post<{ ok: boolean; deleted: number }>('/notifications/bulk-delete', { ids })
  },

  deleteAll: async () => {
    return api.delete<{ ok: boolean; deleted: number }>('/notifications/all')
  },
}

