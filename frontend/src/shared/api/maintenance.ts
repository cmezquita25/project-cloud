/**
 * Estado del modo mantenimiento en el cliente.
 *
 * - El cliente HTTP lo activa al recibir `503 MAINTENANCE` de cualquier ruta.
 * - `MaintenanceGate` lo consulta al arrancar (`/system/status`) y lo vigila.
 * - El admin que activó el mantenimiento guarda un token de paso (bypass) que
 *   viaja en la cabecera `X-Maintenance-Bypass` y le deja seguir usando la app.
 *   Se guarda en localStorage para sobrevivir recargas y cierres de pestaña.
 */

export interface MaintenanceStatus {
  active: boolean
  reason: 'manual' | 'update' | 'restore' | 'unknown' | null
  message: string | null
  started_at: string | null
  expires_at: string | null
}

export const MAINTENANCE_BYPASS_HEADER = 'X-Maintenance-Bypass'
const BYPASS_KEY = 'pc-maintenance-bypass'

const INACTIVE: MaintenanceStatus = { active: false, reason: null, message: null, started_at: null, expires_at: null }

let status: MaintenanceStatus = INACTIVE
const listeners = new Set<(s: MaintenanceStatus) => void>()

export const maintenance = {
  get(): MaintenanceStatus {
    return status
  },

  set(next: MaintenanceStatus): void {
    status = next
    listeners.forEach((l) => l(status))
  },

  markInactive(): void {
    this.set(INACTIVE)
  },

  /** Lo llama el cliente HTTP al recibir un 503 MAINTENANCE. */
  reportActive(message?: string, details?: unknown): void {
    if (status.active) return
    const d = (details && typeof details === 'object' ? details : {}) as Partial<MaintenanceStatus>
    this.set({
      active: true,
      reason: d.reason ?? 'unknown',
      message: message ?? null,
      started_at: d.started_at ?? null,
      expires_at: null,
    })
  },

  subscribe(listener: (s: MaintenanceStatus) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getBypass(): string | null {
    try {
      return localStorage.getItem(BYPASS_KEY)
    } catch {
      return null
    }
  },

  setBypass(token: string | null): void {
    try {
      if (token) localStorage.setItem(BYPASS_KEY, token)
      else localStorage.removeItem(BYPASS_KEY)
    } catch {
      /* almacenamiento no disponible: el admin verá la pantalla de mantenimiento */
    }
  },

  /** Consulta el estado público (sin caché ni sesión). */
  async fetchStatus(): Promise<MaintenanceStatus> {
    const res = await fetch('/api/v1/system/status', { cache: 'no-store' })
    const envelope = (await res.json()) as { success: boolean; data?: { maintenance: MaintenanceStatus } }
    if (!res.ok || !envelope.success || !envelope.data) throw new Error('STATUS_UNAVAILABLE')
    return envelope.data.maintenance
  },
}
