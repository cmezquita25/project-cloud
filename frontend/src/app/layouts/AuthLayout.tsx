import { useRef, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useTheme } from '@app/providers/ThemeProvider'
import { getVersionLabel } from '@shared/config/version'
import { motion } from 'framer-motion'

/** Layout para pantallas sin sesión (login, instalador): tarjeta centrada. */
export function AuthLayout() {
  const settings = usePlatformSettings()
  const { resolved: theme } = useTheme()
  const location = useLocation()
  
  const isFirstMount = useRef(true)
  useEffect(() => {
    isFirstMount.current = false
  }, [])

  const orgName = settings?.organization_name || 'Project Cloud'
  const slogan = settings?.organization_slogan?.trim() || null
  const hasLogo = !!(settings && (settings.logo_white || settings.logo_dark))

  return (
    <div className="relative flex min-h-full items-center justify-center bg-surface-container p-4">
      <div className="w-full max-w-md">
        {/* Identidad: logo + eslogan de la organización */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 flex flex-col items-center justify-center gap-3 text-center"
        >
          {hasLogo ? (
            <img
              src={`/api/v1/settings/logo/${theme === 'dark' && settings!.logo_white ? 'white' : (theme === 'light' && settings!.logo_dark ? 'dark' : 'white')}`}
              alt={orgName}
              className="h-14 max-w-[220px] object-contain transition-opacity duration-300"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-on">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
                </svg>
              </div>
              <span className="text-2xl font-medium text-content-primary">{orgName}</span>
            </div>
          )}
          {slogan && (
            <p className="max-w-sm text-sm text-content-secondary">{slogan}</p>
          )}
        </motion.div>

        {/* Tarjeta con el contenido (login) */}
        <motion.div 
          key={location.pathname}
          initial={
            isFirstMount.current
              ? { opacity: 0, y: 30, rotateX: 5 }
              : { opacity: 0, rotateY: 180 }
          }
          animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0 }}
          transition={{ duration: 0.6, type: 'spring', bounce: 0.2 }}
          className="rounded-2xl border border-border bg-surface p-8 shadow-elevation-1"
          style={{ perspective: 1000, backfaceVisibility: 'hidden' }}
        >
          <Outlet />
        </motion.div>

        {/* Pie: versión + autoría */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col items-center gap-1 text-center"
        >
          <p className="text-xs font-medium text-content-tertiary">{getVersionLabel()}</p>
          <p className="text-sm text-content-tertiary">Creado por Carlos Mezquita Alvarado</p>
        </motion.div>
      </div>

      {/* Botón de tema: flotante, abajo a la derecha (estilo botón elevado). */}
      <div className="fixed bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-elevation-2">
        <ThemeToggle />
      </div>
    </div>
  )
}
