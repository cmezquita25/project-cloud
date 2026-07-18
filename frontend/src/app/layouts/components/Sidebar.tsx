import { Plus } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@shared/lib/cn'
import { Button } from '@shared/ui'
import { StorageIndicator } from '@features/storage-quota/components/StorageIndicator'
import { useAuth } from '@features/auth/AuthProvider'
import { NAV_ITEMS } from '../navigation'

interface SidebarProps {
  /** Cierra el drawer en móvil al navegar. */
  onNavigate?: () => void
}

/** Barra lateral de navegación (clon de Google Drive). */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, isAdmin } = useAuth()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex h-full flex-col bg-surface-container">
      <div className="px-3 py-4">
        <Button
          leftIcon={Plus}
          size="lg"
          variant="secondary"
          className="shadow-elevation-1"
        >
          Nuevo
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border pb-2 pt-2">
        <StorageIndicator
          usedBytes={user?.used_bytes ?? 0}
          totalBytes={user?.quota_bytes ?? 0}
        />
      </div>
    </div>
  )
}
