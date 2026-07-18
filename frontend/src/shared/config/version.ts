import { formatDate } from '@shared/lib/formatDate'

/**
 * ============================================================================
 *  VERSIÓN DE LA APP — Fuente ÚNICA de verdad.
 *  Al publicar una nueva versión, edita SOLO este archivo:
 *    - APP_VERSION      : número de versión (semver).
 *    - APP_LAST_UPDATED : fecha de la última actualización (YYYY-MM-DD).
 *  El resto de la app reutiliza estos valores (login, ajustes, etc.).
 * ============================================================================
 */

export const APP_NAME = 'Project Cloud'

export const APP_VERSION = '0.7.0'

/** Fecha de la última actualización (formato ISO: YYYY-MM-DD). */
export const APP_LAST_UPDATED = '2026-07-18'

/** Etiqueta corta de versión, p.ej. "v0.3.0". */
export function getVersionLabel(): string {
  return `v${APP_VERSION}`
}

/** Fecha de última actualización legible, p.ej. "18 jul 2026". */
export function getLastUpdatedLabel(): string {
  return formatDate(APP_LAST_UPDATED)
}

/** Línea completa para pies de página: "v0.3.0 · Actualizado 18 jul 2026". */
export function getVersionFooter(): string {
  return `${getVersionLabel()} · Actualizado ${getLastUpdatedLabel()}`
}
