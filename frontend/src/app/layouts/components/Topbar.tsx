import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Menu as MenuIcon, Search, X, LogOut, User, Shield } from 'lucide-react'
import { IconButton, Avatar, Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { ThemeToggle } from '@features/settings/components/ThemeToggle'
import { useAuth } from '@features/auth/AuthProvider'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useTheme } from '@app/providers/ThemeProvider'
import { useIsMobile } from '@shared/hooks/useMediaQuery'
import { useHeaderSearch } from '../HeaderSearchContext'
import { cn } from '@shared/lib/cn'

interface TopbarProps {
  onMenuClick: () => void
}

/** Barra superior: logo, buscador, ayuda, tema y menú de cuenta. */
export function Topbar({ onMenuClick }: TopbarProps) {
  const account = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)
  const { user, logout, isAdmin } = useAuth()
  const settings = usePlatformSettings()
  const { resolved: theme } = useTheme()
  const isMobile = useIsMobile()
  const { showInHeader } = useHeaderSearch()

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [term, setTerm] = useState('')

  const orgName = settings?.organization_name || 'Project Cloud'

  // Mantiene el campo sincronizado con la URL (?q=) al entrar/volver a /search.
  useEffect(() => {
    setTerm(searchParams.get('q') ?? '')
  }, [searchParams])

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (q === '') {
      navigate('/search')
      return
    }
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const clearSearch = () => {
    setTerm('')
    navigate('/search')
  }

  const displayName = user?.display_name ?? 'Usuario'
  const email = user?.email ?? ''

  const accountItems: MenuItem[] = [
    { id: 'profile', label: 'Mi perfil', icon: User, onSelect: () => navigate('/profile') },
    ...(isAdmin
      ? [{ id: 'admin', label: 'Administración', icon: Shield, onSelect: () => navigate('/admin') }]
      : []),
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

  const isAdminRole = user?.role === 'admin'
  const roleBadge = (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        isAdminRole
          ? 'bg-danger-subtle text-danger'
          : 'bg-primary-subtle text-primary'
      )}
    >
      {isAdminRole ? 'Administrador' : 'Usuario'}
    </span>
  )

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 sm:px-4">
      <IconButton icon={MenuIcon} label="Menú" onClick={onMenuClick} className="md:hidden" />

      <div className="flex items-center gap-2 pl-1 pr-2 sm:pr-6">
        {settings && (settings.logo_white || settings.logo_dark || settings.logo_mobile) ? (
          <img
            src={`/api/v1/settings/logo/${(isMobile && settings.logo_mobile) ? 'mobile' : (theme === 'dark' && settings.logo_white ? 'white' : (theme === 'light' && settings.logo_dark ? 'dark' : 'white'))}`}
            alt="Logo"
            className="h-8 max-w-[120px] object-contain transition-opacity duration-300"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-on">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M4 5a2 2 0 0 1 2-2h5l2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
            </svg>
          </div>
        )}
        {!(settings?.logo_white || settings?.logo_dark) && (
          <span className="hidden text-xl font-medium text-content-secondary sm:block">
            {orgName}
          </span>
        )}
      </div>

      {/* Buscador (oculto en móvil). En la Home aparece al hacer scroll: el hero
          lo oculta mientras su propio buscador está visible. */}
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        {showInHeader && (
          <form
            onSubmit={submitSearch}
            role="search"
            className="flex h-12 w-full max-w-2xl animate-fade-in items-center gap-3 rounded-pill border border-border bg-surface-container px-4 text-content-secondary transition-colors focus-within:border-transparent focus-within:bg-surface focus-within:ring-2 focus-within:ring-focus"
          >
            <button type="submit" aria-label="Buscar" className="shrink-0 focus-visible:outline-focus">
              <Search size={20} />
            </button>
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Buscar en ${orgName}`}
              aria-label="Buscar"
              className="min-w-0 flex-1 bg-transparent text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:appearance-none"
            />
            {term !== '' && (
              <IconButton icon={X} label="Limpiar búsqueda" size="sm" onClick={clearSearch} />
            )}
          </form>
        )}
      </div>

      {/* Espaciador para móvil: empuja los controles a la derecha */}
      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <div ref={anchor} className="relative ml-1">
          <button
            onClick={account.toggle}
            aria-label="Cuenta"
            className="rounded-full focus-visible:outline-focus"
          >
            <Avatar name={displayName} src={user?.avatar_url} size={32} />
          </button>
          <Menu
            open={account.isOpen}
            onClose={account.close}
            items={accountItems}
            title="Cuenta"
            align="right"
            anchorRef={anchor}
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar name={displayName} src={user?.avatar_url} size={40} />
              <div className="flex min-w-0 flex-col gap-0.5">
                {roleBadge}
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
