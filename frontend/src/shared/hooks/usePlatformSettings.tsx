import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { APP_VERSION } from '../config/version'
import { useAuth } from '@features/auth/AuthProvider'

interface PlatformSettings {
  logo_favicon: boolean
  logo_white: boolean
  logo_dark: boolean
  logo_mobile: boolean
  organization_name: string | null
  organization_slogan: string | null
  support_email: string | null
  primary_color?: string | null
  btn_gradient_start?: string | null
  btn_gradient_end?: string | null
  btn_text_color?: string | null
  /** Estilo base de color. Los colores personalizados de arriba van encima. */
  theme_preset?: string | null
  /** Logo al centro de los QR de los enlaces (lo decide el admin en Apariencia). */
  qr_logo_mode?: 'none' | 'platform' | 'custom'
  qr_logo_url?: string | null
  ga4_measurement_id?: string | null
  ga4_enabled?: boolean
  /** Versión instalada en el servidor. */
  app_version?: string
  app_released_at?: string | null
}

/** Marca para no recargar en bucle si la versión no llegara a coincidir. */
const VERSION_RELOAD_KEY = 'pc-version-reload'

/**
 * Si el servidor ya tiene otra versión (se actualizó mientras la pestaña
 * seguía abierta o el navegador sirvió un index.html viejo), recarga una vez
 * para traer los archivos nuevos.
 */
function reloadIfVersionChanged(serverVersion: string | undefined): boolean {
  if (!serverVersion || serverVersion === APP_VERSION) return false
  try {
    if (sessionStorage.getItem(VERSION_RELOAD_KEY) === serverVersion) return false
    // Las respuestas en caché son de la versión anterior: se descartan.
    sessionStorage.clear()
    sessionStorage.setItem(VERSION_RELOAD_KEY, serverVersion)
  } catch {
    return false // sin almacenamiento no hay forma segura de evitar el bucle
  }
  window.location.reload()
  return true
}

/**
 * Recarga la app descartando las respuestas guardadas en esta pestaña (caché
 * de la API y de React Query). Se usa tras actualizar o revertir la plataforma.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function reloadWithFreshCache(): void {
  try {
    sessionStorage.clear()
  } catch {
    /* sin almacenamiento: la recarga igual trae los archivos nuevos */
  }
  window.location.reload()
}

export type ThemePreset = 'blizzard' | 'nebula' | 'supernova' | 'techmaleon'

const PRESETS_WITH_ATTRIBUTE: ThemePreset[] = ['nebula', 'supernova', 'techmaleon']

/**
 * Normaliza el valor que llega de la API. Acepta los nombres antiguos
 * (`invicter` → Blizzard, `classic` → Nebula) por si una instalación los
 * tiene guardados de antes del cambio de nombre.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeThemePreset(value: string | null | undefined): ThemePreset {
  if (value === 'classic') return 'nebula'
  return (PRESETS_WITH_ATTRIBUTE as string[]).includes(value ?? '') ? (value as ThemePreset) : 'blizzard'
}

/** Clave de caché local: la lee el script anti-parpadeo de `index.html`. */
const PRESET_STORAGE_KEY = 'pc-theme-preset'

/**
 * Aplica el estilo base de color en <html>.
 *
 * Blizzard es el defecto de `index.css`, así que solo Nebula necesita el
 * atributo. Se guarda en localStorage para que `index.html` lo aplique antes
 * del primer pintado en la próxima carga; sin eso se vería Blizzard un
 * instante y luego saltaría a Nebula al llegar la respuesta de la API.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function applyThemePreset(preset: ThemePreset | null | undefined) {
  const root = document.documentElement
  const withAttribute = !!preset && PRESETS_WITH_ATTRIBUTE.includes(preset)
  if (withAttribute) root.setAttribute('data-theme-preset', preset)
  else root.removeAttribute('data-theme-preset')
  try {
    if (withAttribute) localStorage.setItem(PRESET_STORAGE_KEY, preset)
    else localStorage.removeItem(PRESET_STORAGE_KEY)
  } catch {
    // Almacenamiento bloqueado: el preset igual se aplica en esta carga.
  }
}

const SETTINGS_PATCH_EVENT = 'pc:platform-settings-patch'

/** Actualiza la configuración pública en memoria sin recargar. */
// eslint-disable-next-line react-refresh/only-export-components
export function patchPlatformSettings(patch: Partial<PlatformSettings>): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_PATCH_EVENT, { detail: patch }))
}

const PlatformSettingsContext = createContext<PlatformSettings | null>(null)

/** Última configuración pública conocida: se pinta desde el primer instante (nombre, logos). */
const SETTINGS_CACHE_KEY = 'pc-platform-settings'

function readCachedSettings(): PlatformSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    return raw ? (JSON.parse(raw) as PlatformSettings) : null
  } catch {
    return null
  }
}

function writeCachedSettings(data: PlatformSettings): void {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data))
  } catch {
    /* sin almacenamiento: se usará lo que llegue de la API */
  }
}

const hexToRgb = (hexStr: string) => {
  const hex = hexStr.replace('#', '')
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `${r} ${g} ${b}`
  }
  return null
}

/**
 * Aplica el estilo de color. Si el usuario eligió uno propio (Mi perfil), se usa
 * ese tal cual, sin los colores personalizados del admin; si no, el de la
 * plataforma con sus colores personalizados encima.
 */
function applyAppearance(data: PlatformSettings, userPreset: string | null | undefined): void {
  const own = userPreset ? normalizeThemePreset(userPreset) : null
  applyThemePreset(own ?? normalizeThemePreset(data.theme_preset))
  const root = document.documentElement
  const custom = own ? null : data

  /*
    Color primario personalizado, con variante propia para modo oscuro.

    Va en una hoja de estilos con dos reglas (no inline en <html>, que ganaría
    también a `.dark`): el color tal cual en claro y una versión aclarada en
    oscuro. La especificidad (`html:root:root`, `html.dark:root:root`) supera a
    la de los presets (`:root[data-theme-preset]`), así la personalización
    sigue mandando.
  */
  root.style.removeProperty('--color-primary')
  let customStyle = document.getElementById('pc-custom-primary') as HTMLStyleElement | null
  const rgb = custom?.primary_color ? hexToRgb(custom.primary_color) : null
  if (rgb) {
    // Aclarado para oscuro: mezcla con blanco al 40 %.
    const light = rgb
      .split(' ')
      .map((c) => Math.round(Number(c) + (255 - Number(c)) * 0.4))
      .join(' ')
    if (!customStyle) {
      customStyle = document.createElement('style')
      customStyle.id = 'pc-custom-primary'
      document.head.appendChild(customStyle)
    }
    customStyle.textContent =
      `html:root:root{--color-primary:${rgb};--color-check:${rgb}}` +
      `html.dark:root:root{--color-primary:${light}}`
  } else {
    // Sin color personalizado: vuelven los valores del preset (index.css).
    customStyle?.remove()
  }

  const setVar = (name: string, hex: string | null | undefined) => {
    const value = hex ? hexToRgb(hex) : null
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }
  setVar('--color-gradient-start', custom?.btn_gradient_start)
  setVar('--color-gradient-end', custom?.btn_gradient_end)
  setVar('--color-btn-text', custom?.btn_text_color)
}

/**
 * Tema propio de la última persona que usó la app en este navegador. Sin
 * sesión (login, al cerrar sesión, mientras se comprueba la sesión) se usa
 * ese y no el de la organización: así la pantalla de acceso se ve con el
 * estilo que esa persona eligió, y al entrar no salta de un tema a otro.
 */
const LAST_USER_PRESET_KEY = 'pc-last-user-preset'

function readLastUserPreset(): string | null {
  try {
    return localStorage.getItem(LAST_USER_PRESET_KEY)
  } catch {
    return null
  }
}

function rememberUserPreset(preset: string | null): void {
  try {
    if (preset) localStorage.setItem(LAST_USER_PRESET_KEY, preset)
    else localStorage.removeItem(LAST_USER_PRESET_KEY)
  } catch {
    /* sin almacenamiento: el login usará el tema de la organización */
  }
}

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings | null>(readCachedSettings)
  const { user } = useAuth()
  // Con sesión: el de la cuenta (o ninguno = el de la organización). Sin sesión: el último recordado.
  const userPreset = user ? (user.theme_preset ?? null) : readLastUserPreset()

  useEffect(() => {
    if (user) rememberUserPreset(user.theme_preset ?? null)
  }, [user])

  useEffect(() => {
    let active = true
    api.get<PlatformSettings>('/settings/public')
      .then((data) => {
        if (!active) return
        if (reloadIfVersionChanged(data.app_version)) return
        setSettings(data)
        writeCachedSettings(data)

        if (data.logo_favicon) {
          const url = '/api/v1/settings/logo/favicon?t=' + Date.now()

          let iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement
          if (!iconLink) {
            iconLink = document.createElement('link')
            iconLink.rel = 'icon'
            document.head.appendChild(iconLink)
          }
          iconLink.type = 'image/png'
          iconLink.href = url

          let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement
          if (!appleLink) {
            appleLink = document.createElement('link')
            appleLink.rel = 'apple-touch-icon'
            document.head.appendChild(appleLink)
          }
          appleLink.href = url
        }
      })
      .catch(console.error)

    return () => { active = false }
  }, [])

  // Estilo de color: el del usuario (si eligió uno) o el de la plataforma.
  useEffect(() => {
    if (settings) applyAppearance(settings, userPreset)
  }, [settings, userPreset])

  // Título del navegador: "<Organización> - Drive" (o el nombre por defecto).
  // La página de un enlace compartido pone el suyo encima.
  useEffect(() => {
    if (settings) document.title = settings.organization_name ? `${settings.organization_name} - Drive` : 'Drive'
  }, [settings?.organization_name])

  // Cambios hechos desde Configuración que no requieren recargar la página
  // (p. ej. el logo de los QR): se fusionan en la configuración en memoria.
  useEffect(() => {
    const onPatch = (e: Event) => {
      const patch = (e as CustomEvent<Partial<PlatformSettings>>).detail
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    }
    window.addEventListener(SETTINGS_PATCH_EVENT, onPatch)
    return () => window.removeEventListener(SETTINGS_PATCH_EVENT, onPatch)
  }, [])

  return (
    <PlatformSettingsContext.Provider value={settings}>
      {children}
    </PlatformSettingsContext.Provider>
  )
}

export function usePlatformSettings() {
  return useContext(PlatformSettingsContext)
}
