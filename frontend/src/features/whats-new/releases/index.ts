import { APP_VERSION } from '@shared/config/version'
import type { WhatsNewRelease } from '../types'
import { release26 } from './v2.6'

/**
 * Novedades por versión menor. Para una versión nueva: crea `vX.Y.ts` con sus
 * diapositivas y regístrala aquí. Las versiones de parche (2.6.1, 2.6.2…)
 * reutilizan las de su versión menor y no vuelven a mostrar el modal.
 */
const RELEASES: Record<string, WhatsNewRelease> = {
  [release26.id]: release26,
}

/** Las novedades de la versión instalada, o null si esta versión no trae. */
export function currentRelease(): WhatsNewRelease | null {
  const [major, minor] = APP_VERSION.split('.')
  return RELEASES[`${major}.${minor}`] ?? null
}
