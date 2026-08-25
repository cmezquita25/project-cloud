import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useAuth } from '@features/auth/AuthProvider'

declare global {
  interface Window {
    dataLayer?: any[]
    gtag?: (...args: any[]) => void
  }
}

/**
 * Componente dinámico e inteligente de Google Analytics 4 (GA4).
 * Carga automáticamente el script de seguimiento de Google Tag (gtag.js) cuando se configura
 * un ID de medición válido (ej. G-XXXXXXXXXX).
 * Registra visitas a páginas y clasifica usuarios recurrentes vs nuevos enviando `user_id`.
 */
export function GoogleAnalyticsTracker() {
  const settings = usePlatformSettings()
  const { user } = useAuth()
  const location = useLocation()
  const isFirstRender = useRef(true)

  const ga4Id = settings?.ga4_measurement_id?.trim()
  const currentPath = location.pathname + location.search

  // 1. Carga del script oficial de Google Tag
  useEffect(() => {
    if (!ga4Id || (!ga4Id.startsWith('G-') && !ga4Id.startsWith('UA-'))) {
      return
    }

    // Inicializar dataLayer y función gtag oficial
    window.dataLayer = window.dataLayer || []
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
    window.gtag = window.gtag || gtag

    // Inyectar el tag de Google si aún no existe para este ID
    const scriptId = 'ga4-gtag-script'
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null

    if (!scriptTag) {
      scriptTag = document.createElement('script')
      scriptTag.id = scriptId
      scriptTag.async = true
      scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`
      document.head.appendChild(scriptTag)

      window.gtag('js', new Date())
    }

    // Configuración base de GA4 (envía automáticamente el primer page_view de carga inicial)
    const configPayload: Record<string, any> = {}

    if (user?.id) {
      configPayload.user_id = String(user.id)
      configPayload.user_properties = {
        role: user.role,
      }
    }

    window.gtag('config', ga4Id, configPayload)
  }, [ga4Id, user?.id, user?.role])

  // 2. Registro dinámico de cambio de vista/página en navegación SPA
  useEffect(() => {
    if (!ga4Id || (!ga4Id.startsWith('G-') && !ga4Id.startsWith('UA-')) || !window.gtag) {
      return
    }

    // Omitir en la carga inicial porque 'gtag(config)' ya envió el primer page_view
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    window.gtag('event', 'page_view', {
      page_path: currentPath,
      page_location: window.location.href,
      send_to: ga4Id,
    })
  }, [currentPath, ga4Id])

  return null
}
