import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Menu as MenuIcon, Search, X, HelpCircle, LogOut, User } from 'lucide-react'
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

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [term, setTerm] = useState('')

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

      {/* Buscador */}
      <div className="flex min-w-0 flex-1 justify-center">
        <form
          onSubmit={submitSearch}
          role="search"
          className="flex h-12 w-full max-w-2xl items-center gap-3 rounded-pill bg-surface-container px-4 text-content-secondary transition-colors focus-within:bg-surface focus-within:shadow-elevation-1"
        >
          <button type="submit" aria-label="Buscar" className="shrink-0 focus-visible:outline-focus">
            <Search size={20} />
          </button>
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar en Project Cloud"
            aria-label="Buscar en Project Cloud"
            className="min-w-0 flex-1 bg-transparent text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:appearance-none"
          />
          {term !== '' && (
            <IconButton icon={X} label="Limpiar búsqueda" size="sm" onClick={clearSearch} />
          )}
        </form>
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
            anchorRef={anchor}
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
