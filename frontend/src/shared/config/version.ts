import { formatDate } from '@shared/lib/formatDate'

/**
 * ============================================================================
 *  VERSIÓN DE LA APP
 *  La fuente única de verdad es /version.json (raíz del repo). Al publicar una
 *  versión nueva se edita SOLO ese archivo; vite.config.ts inyecta los valores
 *  aquí y scripts/sync-version.mjs los copia al backend (api/version.php).
 * ============================================================================
 */

export const APP_NAME = 'Project Cloud'

export const APP_VERSION = __APP_VERSION__

/** Fecha de la última actualización (formato ISO: YYYY-MM-DD). */
export const APP_LAST_UPDATED = __APP_RELEASED_AT__

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
