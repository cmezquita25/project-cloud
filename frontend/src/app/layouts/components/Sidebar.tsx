import { useRef, useState, useEffect } from 'react'
import { Plus, FolderPlus, FileUp, FolderUp } from 'lucide-react'
import { NavLink, useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { cn } from '@shared/lib/cn'
import { Button, Menu, type MenuItem, IconButton } from '@shared/ui'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { StorageIndicator } from '@features/storage-quota/components/StorageIndicator'
import { useAuth } from '@features/auth/AuthProvider'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'
import { useUploadPicker } from '@features/uploads/hooks/useUploadPicker'
import { NAV_GROUPS, type NavItem } from '../navigation'

function SidebarItem({ item, onNavigate }: { item: NavItem, onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  
  useEffect(() => {
    if (item.subItems?.some(s => location.pathname === s.to || location.pathname.startsWith(s.to + '/'))) {
      setOpen(true)
    }
  }, [location.pathname, item.subItems])

  const Icon = item.icon
  
  if (item.subItems) {
    return (
      <div className="flex flex-col">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center gap-4 rounded-pill px-4 py-2.5 text-sm font-medium transition-colors w-full text-left',
            'text-content-secondary hover:bg-surface-hover'
          )}
        >
          <Icon size={20} />
          <span className="flex-1">{item.label}</span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {open && (
          <div className="mt-1 flex flex-col space-y-1 pl-4 pr-2">
            {item.subItems.map((sub) => {
              const SubIcon = sub.icon
              return (
                <NavLink
                  key={sub.to!}
                  to={sub.to!}
                  end={sub.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-pill px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-subtle text-primary'
                        : 'text-content-secondary hover:bg-surface-hover'
                    )
                  }
                >
                  <SubIcon size={18} />
                  <span>{sub.label}</span>
                </NavLink>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to!}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-4 rounded-pill px-4 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-subtle text-primary'
            : 'text-content-secondary hover:bg-surface-hover'
        )
      }
    >
      <Icon size={20} />
      <span>{item.label}</span>
    </NavLink>
  )
}

interface SidebarProps {
  /** Cierra el drawer en móvil al navegar. */
  onNavigate?: () => void
}

/** Barra lateral de navegación (clon de Google Drive). */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, isAdmin } = useAuth()
  const { access } = useAssetsAccess()
  const location = useLocation()
  const params = useParams()
  
  const isAssets = location.pathname.startsWith('/assets')
  const assetsMatch = location.pathname.match(/^\/assets(?:\/(.+))?$/)
  const currentAssetPath = assetsMatch?.[1] || 'root'
  const currentDriveFolder = params.folderId ? Number(params.folderId) : 'root'
  
  const uploadMode = isAssets ? 'assets' : 'drive'
  const uploadFolderId = isAssets ? currentAssetPath : currentDriveFolder

  const { pickFiles, pickFolder } = useUploadPicker(uploadFolderId, uploadMode)
  const newMenu = useDisclosure()
  const newAnchor = useRef<HTMLDivElement>(null)

  // Filtra grupos e items según rol y acceso a la unidad compartida.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!item.adminOnly || isAdmin) && (!item.requiresAssets || (access?.allowed && access?.active))
    ),
  })).filter((group) => group.items.length > 0)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [term, setTerm] = useState('')

  useEffect(() => {
    setTerm(searchParams.get('q') ?? '')
  }, [searchParams])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (q === '') {
      navigate('/search')
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
    if (onNavigate) onNavigate()
  }

  const clearSearch = () => {
    setTerm('')
    navigate('/search')
    if (onNavigate) onNavigate()
  }

  const newMenuItems: MenuItem[] = [
    {
      id: 'folder',
      label: 'Nueva carpeta',
      icon: FolderPlus,
      onSelect: () => window.dispatchEvent(new CustomEvent('pc:new-folder', { detail: { mode: uploadMode, folderId: uploadFolderId } })),
    },
    { id: 'files', label: 'Subir archivos', icon: FileUp, onSelect: pickFiles, divider: true },
    { id: 'dir', label: 'Subir carpeta', icon: FolderUp, onSelect: pickFolder },
  ]

  return (
    <div className="flex h-full flex-col border-r border-border bg-surface">
      {/* Buscador móvil */}
      <div className="px-3 pt-4 pb-2 md:hidden">
        <form
          onSubmit={submitSearch}
          role="search"
          className="flex h-10 w-full items-center gap-2 rounded-pill bg-surface px-3 text-content-secondary shadow-elevation-1 focus-within:ring-2 focus-within:ring-focus"
        >
          <button type="submit" aria-label="Buscar" className="shrink-0 focus-visible:outline-focus">
            <Search size={16} />
          </button>
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar..."
            className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:appearance-none"
          />
          {term !== '' && (
            <IconButton icon={X} label="Limpiar búsqueda" size="sm" onClick={clearSearch} className="h-6 w-6" />
          )}
        </form>
      </div>

      <div className="flex justify-center px-3 py-2 md:py-4">
        <div ref={newAnchor} className="relative inline-block">
          <Button
            leftIcon={Plus}
            size="lg"
            variant="primary"
            onClick={newMenu.toggle}
          >
            Nuevo
          </Button>
          <Menu
            open={newMenu.isOpen}
            onClose={newMenu.close}
            items={newMenuItems}
            title="Nuevo"
            align="left"
            anchorRef={newAnchor}
          />
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-2">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-4 pb-0.5 pt-1 text-xs font-medium uppercase tracking-wide text-content-tertiary">
              {group.label}
            </p>
            {group.items.map((item) => (
              <SidebarItem key={item.label} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3 pt-2">
        <StorageIndicator
          usedBytes={user?.used_bytes ?? 0}
          totalBytes={user?.quota_bytes ?? 0}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}
