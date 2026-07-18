import { api, session, forceRefresh, ApiError } from '@shared/api'
import type { FileItem, FolderRef } from '@features/drive-explorer/types'

interface InitResponse {
  upload_id: string
  chunk_size: number
  offset: number
  name: string
}

interface InitPayload {
  folder_id: FolderRef
  name: string
  size: number
  mime?: string | null
}

const ref = (id: FolderRef): string => (id === null || id === undefined ? 'root' : String(id))

/** Cliente de subida por chunks (endpoints /uploads/*). */
export const uploadApi = {
  init: (payload: InitPayload) =>
    api.post<InitResponse>('/uploads/init', {
      folder_id: ref(payload.folder_id),
      name: payload.name,
      size: payload.size,
      mime: payload.mime ?? null,
    }),

  /** Envía un trozo (cuerpo crudo). Reintenta una vez tras refrescar el token. */
  async chunk(
    uploadId: string,
    offset: number,
    blob: Blob,
    signal?: AbortSignal,
    retry = false
  ): Promise<{ offset: number }> {
    const token = session.getAccess()
    const res = await fetch(`/api/v1/uploads/${uploadId}/chunk?offset=${offset}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: blob,
      signal,
    })
    if (res.status === 401 && !retry) {
      await forceRefresh()
      return uploadApi.chunk(uploadId, offset, blob, signal, true)
    }
    const env = await res.json().catch(() => null)
    if (!res.ok || !env?.success) {
      throw new ApiError(env?.error?.code ?? 'ERROR', env?.error?.message ?? 'Error al subir', res.status)
    }
    return env.data as { offset: number }
  },

  complete: (uploadId: string) => api.post<FileItem>(`/uploads/${uploadId}/complete`),

  cancel: (uploadId: string) => api.delete<{ ok: true }>(`/uploads/${uploadId}`),
}
