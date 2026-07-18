import { useRef } from 'react'
import { Menu as MenuIcon, Search, HelpCircle, LogOut, User } from 'lucide-react'
import { IconButton, Avatar, Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { useAuth } from '@features/auth/AuthProvider'

interface TopbarProps {
  onMenuClick: () => void
}

/** Barra superior: logo, buscador, ayuda, tema y menú de cuenta. */
export function Topbar({ onMenuClick }: TopbarProps) {
  const account = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()

  const displayName = user?.display_name ?? 'Usuario'
  const email = user?.email ?? ''

  const accountItems: MenuItem[] = [
    { id: 'profile', label: 'Mi perfil', icon: User, onSelect: () => {} },
    {
      id: 'logout',
      label: 'Cerrar sesión',
      icon: LogOut,
      onSelect: () => {
        void logout()
      },
      danger: true,
      divider: true,
    },
  ]

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-canvas px-2 sm:px-4">
      <IconButton icon={MenuIcon} label="Menú" onClick={onMenuClick} className="md:hidden" />

      <div className="flex items-center gap-2 pl-1 pr-2 sm:pr-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-on">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
          </svg>
        </div>
        <span className="hidden text-xl font-medium text-content-secondary sm:block">
          Project Cloud
        </span>
      </div>

      {/* Buscador (funcional en Fase 7) */}
      <div className="flex min-w-0 flex-1 justify-center">
        <label className="flex h-12 w-full max-w-2xl items-center gap-3 rounded-pill bg-surface-container px-4 text-content-secondary transition-colors focus-within:bg-surface focus-within:shadow-elevation-1">
          <Search size={20} />
          <input
            type="search"
            placeholder="Buscar en Project Cloud"
            className="min-w-0 flex-1 bg-transparent text-content-primary outline-none placeholder:text-content-tertiary"
          />
        </label>
      </div>

      <div className="flex items-center gap-1">
        <div className="hidden sm:block">
          <IconButton icon={HelpCircle} label="Ayuda" />
        </div>
        <ThemeToggle />
        <div ref={anchor} className="relative ml-1">
          <button
            onClick={account.toggle}
            aria-label="Cuenta"
            className="rounded-full focus-visible:outline-focus"
          >
            <Avatar name={displayName} size={32} />
          </button>
          <Menu
            open={account.isOpen}
            onClose={account.close}
            items={accountItems}
            title="Cuenta"
            align="right"
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar name={displayName} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content-primary">{displayName}</p>
                <p className="truncate text-xs text-content-tertiary">{email}</p>
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
          </Menu>
        </div>
      </div>
    </header>
  )
}
