import { Outlet } from 'react-router-dom'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'

/** Layout para pantallas sin sesión (login, instalador): tarjeta centrada. */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-full items-center justify-center bg-surface-container p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-on">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
            </svg>
          </div>
          <span className="text-2xl font-medium text-content-primary">Project Cloud</span>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8 shadow-elevation-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
