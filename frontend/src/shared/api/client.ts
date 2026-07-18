import { ApiError } from './ApiError'
import { session } from './session'
import type { ApiEnvelope } from './types'

/**
 * Cliente HTTP de Project Cloud.
 *
 * - Prefija /api/v1 (en dev, Vite proxya /api → :8000).
 * - Inyecta el access token (Authorization: Bearer).
 * - Auto-refresh transparente: ante un 401, intenta refrescar el token una vez
 *   (single-flight: peticiones concurrentes comparten el mismo refresh) y
 *   reintenta la petición original.
 * - Desempaqueta el envelope { success, data, error } y lanza ApiError.
 */

const BASE_URL = '/api/v1'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  signal?: AbortSignal
  /** No intentar auto-refresh (para endpoints de auth). */
  skipAuthRefresh?: boolean
}

/** Callback invocado cuando la sesión expira irrecuperablemente. */
let onSessionExpired: (() => void) | null = null
export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb
}

// Single-flight del refresh: si varias peticiones fallan con 401 a la vez,
// solo se dispara UN refresh y todas esperan su resultado.
let refreshInFlight: Promise<void> | null = null

async function doRefresh(): Promise<void> {
  const refreshToken = session.getRefresh()
  if (!refreshToken) throw new ApiError('NO_SESSION', 'No hay sesión activa', 401)

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<{
    access_token: string
    refresh_token: string
  }> | null

  if (!res.ok || !envelope?.success || !envelope.data) {
    session.clear()
    throw new ApiError(
      envelope?.error?.code ?? 'REFRESH_FAILED',
      envelope?.error?.message ?? 'La sesión expiró',
      res.status
    )
  }
  session.set(envelope.data.access_token, envelope.data.refresh_token)
}

function refreshOnce(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/** Fuerza un refresh del access token (para subidas largas por fetch/XHR crudo). */
export function forceRefresh(): Promise<void> {
  return refreshOnce()
}

async function raw(method: Method, path: string, body: unknown, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const access = session.getAccess()
  if (access) headers['Authorization'] = `Bearer ${access}`

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: options.signal,
  })
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  let res: Response
  try {
    res = await raw(method, path, body, options)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('NETWORK_ERROR', 'No se pudo conectar con el servidor', 0)
  }

  // Auto-refresh ante 401 (una sola vez).
  if (res.status === 401 && !options.skipAuthRefresh && session.hasSession()) {
    try {
      await refreshOnce()
      res = await raw(method, path, body, options)
    } catch {
      onSessionExpired?.()
      throw new ApiError('SESSION_EXPIRED', 'Tu sesión expiró. Inicia de nuevo.', 401)
    }
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
    throw new ApiError(
      envelope.error?.code ?? 'ERROR',
      envelope.error?.message ?? 'Ocurrió un error',
      res.status,
      envelope.error?.details
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
