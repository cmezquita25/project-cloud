import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'

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
  ga4_measurement_id?: string | null
  ga4_enabled?: boolean
}

export type ThemePreset = 'blizzard' | 'nebula'

/**
 * Normaliza el valor que llega de la API. Acepta los nombres antiguos
 * (`invicter` → Blizzard, `classic` → Nebula) por si una instalación los
 * tiene guardados de antes del cambio de nombre.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeThemePreset(value: string | null | undefined): ThemePreset {
  return value === 'nebula' || value === 'classic' ? 'nebula' : 'blizzard'
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
  if (preset === 'nebula') root.setAttribute('data-theme-preset', 'nebula')
  else root.removeAttribute('data-theme-preset')
  try {
    if (preset === 'nebula') localStorage.setItem(PRESET_STORAGE_KEY, 'nebula')
    else localStorage.removeItem(PRESET_STORAGE_KEY)
  } catch {
    // Almacenamiento bloqueado: el preset igual se aplica en esta carga.
  }
}

const PlatformSettingsContext = createContext<PlatformSettings | null>(null)

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null)

  useEffect(() => {
    let active = true
    api.get<PlatformSettings>('/settings/public')
      .then((data) => {
        if (!active) return
        setSettings(data)
        applyThemePreset(normalizeThemePreset(data.theme_preset))

        // Título del navegador: "<Organización> - Drive" (o el nombre por defecto).
        document.title = data.organization_name
          ? `${data.organization_name} - Drive`
          : 'Project Cloud'

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

        /*
          Color primario personalizado, con variante propia para modo oscuro.

          Antes se escribía inline en <html>, y un estilo inline gana también
          a `.dark`: en oscuro quedaba el mismo azul medio que en claro, con
          poco contraste sobre el vidrio oscuro (textos, iconos, badges,
          activos). Ahora va en una hoja de estilos con dos reglas: el color
          tal cual en claro y una versión aclarada en oscuro. La especificidad
          (`html:root:root`, `html.dark:root:root`) supera a la de los presets
          (`:root[data-theme-preset]`), así la personalización sigue mandando.
        */
        document.documentElement.style.removeProperty('--color-primary')
        let customStyle = document.getElementById('pc-custom-primary') as HTMLStyleElement | null
        const rgb = data.primary_color ? hexToRgb(data.primary_color) : null
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

        if (data.btn_gradient_start) {
          const rgb = hexToRgb(data.btn_gradient_start)
          if (rgb) document.documentElement.style.setProperty('--color-gradient-start', rgb)
        } else {
          document.documentElement.style.removeProperty('--color-gradient-start')
        }
        
        if (data.btn_gradient_end) {
          const rgb = hexToRgb(data.btn_gradient_end)
          if (rgb) document.documentElement.style.setProperty('--color-gradient-end', rgb)
        } else {
          document.documentElement.style.removeProperty('--color-gradient-end')
        }
        if (data.btn_text_color) {
          const rgb = hexToRgb(data.btn_text_color)
          if (rgb) document.documentElement.style.setProperty('--color-btn-text', rgb)
        } else {
          document.documentElement.style.removeProperty('--color-btn-text')
        }
      })
      .catch(console.error)

    return () => { active = false }
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
