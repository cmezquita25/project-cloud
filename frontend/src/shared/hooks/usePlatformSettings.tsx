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

        if (data.primary_color) {
          const rgb = hexToRgb(data.primary_color)
          if (rgb) {
            document.documentElement.style.setProperty('--color-primary', rgb)
          }
        } else {
          // Si no hay color primario, limpiamos para que regrese a los defaults de index.css
          document.documentElement.style.removeProperty('--color-primary')
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
