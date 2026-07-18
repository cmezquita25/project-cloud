import { ApiError } from './ApiError'
import type { ApiEnvelope } from './types'

/**
 * Cliente HTTP base de Project Cloud.
 *
 * - Prefija todas las rutas con /api/v1 (en dev, Vite proxya /api → :8000).
 * - Desempaqueta el envelope { success, data, error }.
 * - Lanza ApiError en fallos (código estable + mensaje + detalles).
 *
 * En la Fase 3 se extiende con el token de acceso y el auto-refresh.
 */

const BASE_URL = '/api/v1'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  signal?: AbortSignal
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('NETWORK_ERROR', 'No se pudo conectar con el servidor', 0)
  }

  if (res.status === 204) {
    return undefined as T
  }

  let envelope: ApiEnvelope<T>
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'Respuesta inválida del servidor', res.status)
  }

  if (!res.ok || !envelope.success) {
    const error = envelope.error
    throw new ApiError(
      error?.code ?? 'ERROR',
      error?.message ?? 'Ocurrió un error',
      res.status,
      error?.details
    )
  }

  return envelope.data as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
}
