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
          const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link')
          link.type = 'image/x-icon'
          link.rel = 'shortcut icon'
          link.href = '/api/v1/settings/logo/favicon?t=' + Date.now()
          document.getElementsByTagName('head')[0]?.appendChild(link)
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
