import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@features/auth/AuthProvider'
import { WhatsNewDialog, type WhatsNewMode } from './components/WhatsNewDialog'
import { currentRelease } from './releases'
import { seenStore } from './lib/seenStore'

interface WhatsNewContextValue {
  /** ¿Esta versión trae novedades? (muestra el enlace del pie de página). */
  available: boolean
  /** Vuelve a reproducirlas (no cambia lo que el usuario ya decidió). */
  replay: () => void
}

const WhatsNewContext = createContext<WhatsNewContextValue>({ available: false, replay: () => {} })

/** Pausa antes de abrirlas solas: deja que la app termine de pintarse. */
const AUTO_OPEN_DELAY_MS = 900

/**
 * Muestra las novedades de la versión una vez a cada usuario (dentro de la
 * app, con sesión). «Recordármelo después» las pospone a la próxima visita;
 * «No volver a mostrar» o «¡Entendido!» las descartan en este navegador.
 */
export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const release = useMemo(currentRelease, [])
  const [mode, setMode] = useState<WhatsNewMode | null>(null)
  const userId = user?.id

  useEffect(() => {
    if (!release || userId === undefined) return
    if (seenStore.isDismissed(release.id, userId) || seenStore.isSnoozed(release.id, userId)) return
    const t = window.setTimeout(() => setMode((m) => m ?? 'auto'), AUTO_OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [release, userId])

  const later = useCallback(() => {
    if (release && userId !== undefined && mode === 'auto') seenStore.snooze(release.id, userId)
    setMode(null)
  }, [release, userId, mode])

  const dismiss = useCallback(() => {
    if (release && userId !== undefined) seenStore.dismiss(release.id, userId)
    setMode(null)
  }, [release, userId])

  // Ir a la función cuenta como «más tarde»: si no terminó de verlas, vuelven en la próxima visita.
  const action = useCallback(
    (to: string) => {
      later()
      navigate(to)
    },
    [later, navigate]
  )

  const value = useMemo<WhatsNewContextValue>(
    () => ({ available: release !== null, replay: () => setMode('replay') }),
    [release]
  )

  return (
    <WhatsNewContext.Provider value={value}>
      {children}
      {release && mode && <WhatsNewDialog key={mode} release={release} mode={mode} onLater={later} onDismiss={dismiss} onAction={action} />}
    </WhatsNewContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWhatsNew(): WhatsNewContextValue {
  return useContext(WhatsNewContext)
}
