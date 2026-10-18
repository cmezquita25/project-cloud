import { ApiError } from './ApiError'
import { session } from './session'
import { maintenance, MAINTENANCE_BYPASS_HEADER } from './maintenance'
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
 * - Modo mantenimiento: un 503 MAINTENANCE activa la pantalla de mantenimiento
 *   (sin cerrar la sesión local) y el token de paso del admin viaja en cada
 *   petición.
 */

/** Cabeceras comunes: token de paso del modo mantenimiento (si lo hay). */
function maintenanceHeaders(): Record<string, string> {
  const bypass = maintenance.getBypass()
  return bypass ? { [MAINTENANCE_BYPASS_HEADER]: bypass } : {}
}

/** Si la respuesta es un 503 de mantenimiento, lo registra y devuelve el error. */
async function asMaintenanceError(res: Response): Promise<ApiError | null> {
  if (res.status !== 503) return null
  const envelope = (await res.clone().json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (envelope?.error?.code !== 'MAINTENANCE') return null
  maintenance.reportActive(envelope.error.message, envelope.error.details)
  return new ApiError('MAINTENANCE', envelope.error.message, 503, envelope.error.details)
}

const BASE_URL = '/api/v1'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  signal?: AbortSignal
  /** No intentar auto-refresh (para endpoints de auth). */
  skipAuthRefresh?: boolean
  /** Headers adicionales para la petición. */
  headers?: Record<string, string>
}

/** Callback invocado cuando la sesión expira o es revocada. */
let onSessionExpired: ((reason?: string, message?: string) => void) | null = null
export function setOnSessionExpired(cb: ((reason?: string, message?: string) => void) | null): void {
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
    headers: { 'Content-Type': 'application/json', ...maintenanceHeaders() },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  // En mantenimiento la sesión sigue siendo válida: no se borra.
  const maintenanceError = await asMaintenanceError(res)
  if (maintenanceError) throw maintenanceError

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
  const headers: Record<string, string> = maintenanceHeaders()

  let fetchBody: BodyInit | undefined = undefined
  if (body !== undefined) {
    if (body instanceof FormData) {
      fetchBody = body
      // El navegador pondrá el Content-Type automáticamente con el boundary para FormData.
    } else {
      headers['Content-Type'] = 'application/json'
      fetchBody = JSON.stringify(body)
    }
  }

  const access = session.getAccess()
  if (access) headers['Authorization'] = `Bearer ${access}`

  if (options.headers) {
    Object.assign(headers, options.headers)
  }

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: fetchBody,
    signal: options.signal,
  })
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const cacheKey = `api_cache_${path}`
  let cachedData: T | null = null

  if (method === 'GET') {
    const cachedStr = sessionStorage.getItem(cacheKey)
    if (cachedStr) {
      try {
        const parsed = JSON.parse(cachedStr)
        if (parsed.etag && parsed.data !== undefined) {
          cachedData = parsed.data
          options.headers = { ...options.headers, 'If-None-Match': parsed.etag }
        }
      } catch {
        sessionStorage.removeItem(cacheKey)
      }
    }
  }

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
    } catch (refreshErr) {
      if (refreshErr instanceof ApiError && refreshErr.code === 'MAINTENANCE') throw refreshErr
      const code = refreshErr instanceof ApiError ? refreshErr.code : 'SESSION_EXPIRED'
      const msg = refreshErr instanceof ApiError ? refreshErr.message : 'Tu sesión expiró. Inicia de nuevo.'
      session.clear()
      onSessionExpired?.(code, msg)
      throw new ApiError(code, msg, 401)
    }
  }

  const maintenanceError = await asMaintenanceError(res)
  if (maintenanceError) throw maintenanceError

  if (res.status === 204) {
    return undefined as T
  }

  if (res.status === 304 && cachedData !== null) {
    return cachedData
  }

  let envelope: ApiEnvelope<T>
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'Respuesta inválida del servidor', res.status)
  }

  if (!res.ok || !envelope.success) {
    const code = envelope.error?.code ?? 'ERROR'
    const msg = envelope.error?.message ?? 'Ocurrió un error'
    if (code === 'ACCOUNT_SUSPENDED') {
      session.clear()
      onSessionExpired?.('ACCOUNT_SUSPENDED', msg)
    }
    throw new ApiError(
      code,
      msg,
      res.status,
      envelope.error?.details
    )
  }

  const data = envelope.data as T

  if (method === 'GET' && res.status === 200) {
    const etag = res.headers.get('ETag')
    if (etag) {
      sessionStorage.setItem(cacheKey, JSON.stringify({ etag, data }))
    }
  }

  return data
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
