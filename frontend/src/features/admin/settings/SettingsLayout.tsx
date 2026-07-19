import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@shared/lib/cn'
import { SETTINGS_NAV } from './settingsNav'

/**
 * Configuración con navegación vertical a la izquierda y contenido a ancho
 * completo (aprovecha el espacio del layout, sin encajonar en max-w-3xl).
 * En móvil la navegación pasa a una tira horizontal con scroll.
 */
export function SettingsLayout() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Configuración</h1>

      <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-6">
        <nav className="flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-56 sm:flex-col sm:space-y-1 sm:overflow-x-visible sm:overflow-y-auto sm:pb-0 sm:pr-1">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-3 rounded-pill px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-primary-subtle text-primary'
                    : 'text-content-secondary hover:bg-surface-hover'
                )
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
