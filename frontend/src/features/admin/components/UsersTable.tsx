import { useRef } from 'react'
import { MoreVertical, Pencil, KeyRound, Trash2, UserCheck, UserX } from 'lucide-react'
import { Avatar, IconButton, Menu, ProgressBar, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { cn } from '@shared/lib/cn'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import type { AdminUser } from '../types'

interface UsersTableProps {
  users: AdminUser[]
  currentUserId: number
  onEdit: (u: AdminUser) => void
  onResetPassword: (u: AdminUser) => void
  onToggleStatus: (u: AdminUser) => void
  onDelete: (u: AdminUser) => void
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-pill px-2 py-0.5 text-xs font-medium',
        role === 'admin' ? 'bg-primary-subtle text-primary' : 'bg-surface-hover text-content-secondary'
      )}
    >
      {role === 'admin' ? 'Administrador' : 'Usuario'}
    </span>
  )
}

function UserMenu({ user, currentUserId, onEdit, onResetPassword, onToggleStatus, onDelete }: {
  user: AdminUser
  currentUserId: number
} & Pick<UsersTableProps, 'onEdit' | 'onResetPassword' | 'onToggleStatus' | 'onDelete'>) {
  const { isOpen, toggle, close } = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)
  const isSelf = user.id === currentUserId

  const items: MenuItem[] = [
    { id: 'edit', label: 'Editar', icon: Pencil, onSelect: () => onEdit(user) },
    { id: 'pwd', label: 'Restablecer contraseña', icon: KeyRound, onSelect: () => onResetPassword(user) },
    {
      id: 'status',
      label: user.status === 'active' ? 'Suspender' : 'Activar',
      icon: user.status === 'active' ? UserX : UserCheck,
      onSelect: () => onToggleStatus(user),
      disabled: isSelf,
      divider: true,
    },
    { id: 'del', label: 'Eliminar', icon: Trash2, onSelect: () => onDelete(user), danger: true, disabled: isSelf },
  ]

  return (
    <div ref={anchor} className="relative inline-block">
      <IconButton icon={MoreVertical} label="Acciones" size="sm" active={isOpen} onClick={toggle} />
      <Menu open={isOpen} onClose={close} items={items} title={user.display_name} align="right" />
    </div>
  )
}

/** Tabla de usuarios (cards en móvil). */
export function UsersTable(props: UsersTableProps) {
  const { users, currentUserId } = props

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-hidden rounded-drive border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
              <th className="px-4 py-2 font-medium">Usuario</th>
              <th className="py-2 font-medium">Rol</th>
              <th className="py-2 font-medium">Estado</th>
              <th className="py-2 font-medium">Almacenamiento</th>
              <th className="w-12 py-2 pr-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.display_name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content-primary">{u.display_name}</p>
                      <p className="truncate text-xs text-content-tertiary">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-2"><RoleBadge role={u.role} /></td>
                <td className="py-2">
                  <span className={cn('text-xs font-medium', u.status === 'active' ? 'text-success' : 'text-danger')}>
                    {u.status === 'active' ? 'Activo' : 'Suspendido'}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <div className="w-40">
                    <ProgressBar value={usagePercent(u.used_bytes, u.quota_bytes)} size="sm" />
                    <p className="mt-1 text-xs text-content-tertiary">
                      {formatBytes(u.used_bytes)} / {formatBytes(u.quota_bytes)}
                    </p>
                  </div>
                </td>
                <td className="py-2 pr-2 text-right">
                  <UserMenu user={u} {...props} currentUserId={currentUserId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil */}
      <div className="space-y-3 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-drive border border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              <Avatar name={u.display_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-content-primary">{u.display_name}</p>
                <p className="truncate text-xs text-content-tertiary">{u.email}</p>
              </div>
              <UserMenu user={u} {...props} currentUserId={currentUserId} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <RoleBadge role={u.role} />
              <span className={cn('text-xs font-medium', u.status === 'active' ? 'text-success' : 'text-danger')}>
                {u.status === 'active' ? 'Activo' : 'Suspendido'}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={usagePercent(u.used_bytes, u.quota_bytes)} size="sm" />
              <p className="mt-1 text-xs text-content-tertiary">
                {formatBytes(u.used_bytes)} / {formatBytes(u.quota_bytes)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
