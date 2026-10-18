import type { DriveItem } from '../types'

/**
 * URL pública directa de un archivo, o null si no tiene (carpetas y archivos
 * privados: su `url` es un enlace firmado temporal, no apto para compartir).
 */
export function publicUrlOf(item: DriveItem): string | null {
  // public_url === null: sin URL directa (privado, o archivo visto por un enlace compartido).
  if (item.type !== 'file' || item.visibility === 'private' || item.public_url === null) return null
  return item.public_url ?? item.url
}
