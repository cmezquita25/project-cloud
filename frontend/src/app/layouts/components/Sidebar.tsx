import { useRef } from 'react'
import { Plus, FolderPlus, FileUp, FolderUp, Images } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'
import { cn } from '@shared/lib/cn'
import { Button, Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { StorageIndicator } from '@features/storage-quota/components/StorageIndicator'
import { useAuth } from '@features/auth/AuthProvider'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'
import { useUploadPicker } from '@features/uploads/hooks/useUploadPicker'
import type { FolderRef } from '@features/drive-explorer/types'
import { NAV_ITEMS } from '../navigation'

interface SidebarProps {
  /** Cierra el drawer en móvil al navegar. */
  onNavigate?: () => void
}

/** Barra lateral de navegación (clon de Google Drive). */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, isAdmin } = useAuth()
  const { access } = useAssetsAccess()
  const params = useParams()
  const folderId: FolderRef = params.folderId ? Number(params.folderId) : 'root'
  const { pickFiles, pickFolder } = useUploadPicker(folderId)
  const newMenu = useDisclosure()
  const newAnchor = useRef<HTMLDivElement>(null)
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  const newMenuItems: MenuItem[] = [
    {
      id: 'folder',
      label: 'Nueva carpeta',
      icon: FolderPlus,
      onSelect: () => window.dispatchEvent(new CustomEvent('pc:new-folder')),
    },
    { id: 'files', label: 'Subir archivos', icon: FileUp, onSelect: pickFiles, divider: true },
    { id: 'dir', label: 'Subir carpeta', icon: FolderUp, onSelect: pickFolder },
  ]

  return (
    <div className="flex h-full flex-col bg-surface-container">
      <div className="px-3 py-4">
        <div ref={newAnchor} className="relative inline-block">
          <Button
            leftIcon={Plus}
            size="lg"
            variant="secondary"
            className="shadow-elevation-1"
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

        {/* Unidad compartida "assets": solo si el usuario tiene acceso. */}
        {access?.allowed && (
          <NavLink
            to="/assets"
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
            <Images size={20} />
            <span>Assets</span>
          </NavLink>
        )}
      </nav>

      <div className="border-t border-border pb-2 pt-2">
        <StorageIndicator
          usedBytes={user?.used_bytes ?? 0}
          totalBytes={user?.quota_bytes ?? 0}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}
