import { useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useTheme } from '@app/providers/ThemeProvider'
import { getVersionLabel } from '@shared/config/version'

/** Layout para pantallas sin sesión (login, instalador): tarjeta centrada. */
export function AuthLayout() {
  const settings = usePlatformSettings()
  const { resolved: theme } = useTheme()

  // Clave de caché estable del logo (una vez por montaje): evita recargarlo —y
  // que parpadee— al alternar el tema.
  const logoCacheKey = useMemo(() => Date.now(), [])
  const orgName = settings?.organization_name || 'Project Cloud'
  const slogan = settings?.organization_slogan?.trim() || null
  const hasLogo = !!(settings && (settings.logo_white || settings.logo_dark))

  return (
    <div className="relative flex min-h-full items-center justify-center bg-surface-container p-4">
      <div className="w-full max-w-md">
        {/* Identidad: logo + eslogan de la organización */}
        <div className="mb-6 flex flex-col items-center justify-center gap-3 text-center">
          {hasLogo ? (
            <img
              src={`/api/v1/settings/logo/${theme === 'dark' && settings!.logo_white ? 'white' : (theme === 'light' && settings!.logo_dark ? 'dark' : 'white')}?t=${logoCacheKey}`}
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
        </div>

        {/* Tarjeta con el contenido (login) */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-elevation-1">
          <Outlet />
        </div>

        {/* Pie: versión + autoría */}
        <div className="mt-8 flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium text-content-tertiary">{getVersionLabel()}</p>
          <p className="text-sm text-content-tertiary">Creado por Carlos Mezquita Alvarado</p>
        </div>
      </div>

      {/* Botón de tema: flotante, abajo a la derecha (estilo botón elevado). */}
      <div className="fixed bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-elevation-2">
        <ThemeToggle />
      </div>
    </div>
  )
}
