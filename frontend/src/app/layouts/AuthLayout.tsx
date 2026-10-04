import { useRef, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useTheme } from '@app/providers/ThemeProvider'
import { getVersionLabel } from '@shared/config/version'
import { motion } from 'framer-motion'
import { AppBackdrop, CursorGlow } from '@shared/ui'

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
    // Sin fondo propio: el `AppBackdrop` va en -z-10 y un `bg-*` aquí lo
    // taparía. El color de base lo pinta `body`.
    <div className="relative flex min-h-full items-center justify-center overflow-hidden p-4">
      {/* Fondo de marca animado + brillo del cursor (solo en acceso). Sustituye
          a los halos con `blur-2xl` + `mix-blend-multiply`, mucho más caros. */}
      <AppBackdrop animated />
      <CursorGlow />

      <div className="relative z-10 w-full max-w-md">
        {/* Halo de marca DETRÁS de la tarjeta: es lo que el vidrio desenfoca.
            Sin él la tarjeta solo tenía detrás el fondo casi negro y se veía
            gris (los halos del fondo quedan en las esquinas). `-z-10` dentro
            de este contenedor (que ya es contexto de apilamiento) lo pinta
            detrás de la tarjeta pero encima del fondo. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 flex -translate-y-1/2 justify-center">
          <div className="orb h-[36rem] w-[36rem] animate-pulse-glow text-glow-a/25 dark:text-glow-a/50" />
          <div className="orb -ml-72 mt-32 h-96 w-96 animate-pulse-glow text-glow-b/20 [animation-delay:-2.5s] dark:text-glow-b/45" />
        </div>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gradient-start to-gradient-end text-btn-text shadow-[0_10px_30px_-8px_rgb(var(--glow-a)/0.7)]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
                </svg>
              </div>
              <span className="text-gradient text-2xl font-semibold">{orgName}</span>
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
          className="glass-strong rounded-2xl p-8 ring-1 ring-slate-900/5 dark:ring-white/10 dark:[background:linear-gradient(145deg,rgb(255_255_255/0.08),rgb(255_255_255/0.02))]"
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
      <div className="glass-strong glass-hover fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full">
        <ThemeToggle />
      </div>
    </div>
  )
}
