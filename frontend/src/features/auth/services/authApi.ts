import { api, session } from '@shared/api'
import type { AuthTokens, LoginCredentials, User } from '../types'

/** Llamadas al backend de autenticación (endpoints /auth/*). */
export const authApi = {
  async login(credentials: LoginCredentials): Promise<User> {
    const data = await api.post<AuthTokens>('/auth/login', credentials, { skipAuthRefresh: true })
    session.set(data.access_token, data.refresh_token, credentials.remember ?? true)
    return data.user
  },

  /** Rehidrata la sesión al arrancar usando el refresh token guardado. */
  async restore(): Promise<User> {
    const refresh = session.getRefresh()
    if (!refresh) throw new Error('Sin sesión')
    const data = await api.post<AuthTokens>(
      '/auth/refresh',
      { refresh_token: refresh },
      { skipAuthRefresh: true }
    )
    session.set(data.access_token, data.refresh_token)
    return data.user
  },

  async logout(): Promise<void> {
    const refresh = session.getRefresh()
    try {
      if (refresh) {
        await api.post('/auth/logout', { refresh_token: refresh }, { skipAuthRefresh: true })
      }
    } finally {
      session.clear()
    }
  },

  me(signal?: AbortSignal): Promise<User> {
    return api.get<User>('/auth/me', { signal })
  },

  /** Actualiza el perfil propio (nombre visible y/o correo). */
  updateProfile(payload: { display_name?: string; email?: string }): Promise<User> {
    return api.patch<User>('/auth/me', payload)
  },

  /** Cambia la contraseña propia (verifica la actual). */
  changePassword(payload: { current_password: string; new_password: string }): Promise<{ ok: true }> {
    return api.post<{ ok: true }>('/auth/me/password', payload)
  },

  /** Sube o reemplaza la foto de perfil (multipart). */
  uploadAvatar(file: File): Promise<User> {
    const fd = new FormData()
    fd.append('avatar', file)
    return api.post<User>('/auth/me/avatar', fd)
  },

  /** Elimina la foto de perfil (vuelve a las iniciales). */
  removeAvatar(): Promise<User> {
    return api.delete<User>('/auth/me/avatar')
  },

  // --- Restablecimiento de contraseña (público) ---

  /** Solicita el enlace de restablecimiento (respuesta neutra siempre). */
  requestPasswordReset(login: string): Promise<{ ok: true }> {
    return api.post<{ ok: true }>('/auth/password/forgot', { login }, { skipAuthRefresh: true })
  },

  /** Comprueba si un token de restablecimiento sigue vigente. */
  validateResetToken(token: string): Promise<{ valid: boolean }> {
    return api.get<{ valid: boolean }>(
      `/auth/password/reset/${encodeURIComponent(token)}/validate`,
      { skipAuthRefresh: true }
    )
  },

  /** Fija la nueva contraseña con un token válido. */
  confirmPasswordReset(token: string, password: string): Promise<{ ok: true }> {
    return api.post<{ ok: true }>('/auth/password/reset', { token, password }, { skipAuthRefresh: true })
  },
}
