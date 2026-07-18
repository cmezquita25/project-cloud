/**
 * Almacén de sesión del cliente.
 *  - Access token: en memoria (no se persiste; se re-obtiene con el refresh).
 *  - Refresh token: en localStorage (sobrevive recargas de página).
 *
 * Nota de seguridad: al ser JWT en el navegador, es sensible a XSS. La CSP del
 * .htaccess y el escape de React mitigan el riesgo. Un endurecimiento futuro
 * sería mover el refresh a una cookie HttpOnly.
 */

const REFRESH_KEY = 'pc-refresh-token'

let accessToken: string | null = null

export const session = {
  getAccess(): string | null {
    return accessToken
  },
  setAccess(token: string | null): void {
    accessToken = token
  },
  getRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  setRefresh(token: string | null): void {
    try {
      if (token) localStorage.setItem(REFRESH_KEY, token)
      else localStorage.removeItem(REFRESH_KEY)
    } catch {
      /* almacenamiento no disponible */
    }
  },
  /** Guarda ambos tokens tras un login/refresh exitoso. */
  set(access: string, refresh: string): void {
    this.setAccess(access)
    this.setRefresh(refresh)
  },
  clear(): void {
    accessToken = null
    this.setRefresh(null)
  },
  hasSession(): boolean {
    return this.getRefresh() !== null
  },
}
