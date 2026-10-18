/**
 * Qué novedades ya descartó cada usuario en este navegador.
 *
 * - «No volver a mostrar» / «Entendido» → localStorage (no se borra al cerrar
 *   el navegador ni con la limpieza de sesiones).
 * - «Recordármelo después» → solo en memoria: no vuelve a salir mientras siga
 *   abierta la app, y reaparece en la próxima visita.
 *
 * La clave incluye el usuario: en un equipo compartido cada cuenta ve las
 * novedades una vez.
 */

const key = (releaseId: string, userId: number) => `pc-whats-new:${releaseId}:${userId}`

const snoozed = new Set<string>()

export const seenStore = {
  isDismissed(releaseId: string, userId: number): boolean {
    try {
      return localStorage.getItem(key(releaseId, userId)) === 'dismissed'
    } catch {
      return false
    }
  },
  dismiss(releaseId: string, userId: number): void {
    try {
      localStorage.setItem(key(releaseId, userId), 'dismissed')
    } catch {
      snoozed.add(key(releaseId, userId)) // sin almacenamiento: al menos no se repite en esta visita
    }
  },
  isSnoozed(releaseId: string, userId: number): boolean {
    return snoozed.has(key(releaseId, userId))
  },
  snooze(releaseId: string, userId: number): void {
    snoozed.add(key(releaseId, userId))
  },
}
