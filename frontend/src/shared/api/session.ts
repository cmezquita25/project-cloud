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
      return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  setRefresh(token: string | null, remember: boolean = true): void {
    try {
      if (token) {
        if (remember) {
          localStorage.setItem(REFRESH_KEY, token)
          sessionStorage.removeItem(REFRESH_KEY)
        } else {
          sessionStorage.setItem(REFRESH_KEY, token)
          localStorage.removeItem(REFRESH_KEY)
        }
      } else {
        localStorage.removeItem(REFRESH_KEY)
        sessionStorage.removeItem(REFRESH_KEY)
      }
    } catch {
      /* almacenamiento no disponible */
    }
  },
  /** Guarda ambos tokens tras un login/refresh exitoso. */
  set(access: string, refresh: string, remember: boolean = true): void {
    this.setAccess(access)
    this.setRefresh(refresh, remember)
  },
  clear(): void {
    accessToken = null
    this.setRefresh(null)
  },
  hasSession(): boolean {
    return this.getRefresh() !== null
  },
}
