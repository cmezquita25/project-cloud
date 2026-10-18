import type { DriveItem } from '../types'

/**
 * URL pública directa de un archivo, o null si no tiene (carpetas y archivos
 * privados: su `url` es un enlace firmado temporal, no apto para compartir).
 */
export function publicUrlOf(item: DriveItem): string | null {
  if (item.type !== 'file' || item.visibility === 'private') return null
  return item.public_url ?? item.url
}
