import { useRef } from 'react'
import { MoreVertical, Pencil, KeyRound, Trash2, UserCheck, UserX, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Avatar, IconButton, Menu, ProgressBar, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { cn } from '@shared/lib/cn'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import { Pagination } from '@shared/ui/Pagination'
import type { AdminUser } from '../types'

export type UserSortField = 'id' | 'username' | 'display_name' | 'role' | 'status' | 'max_upload_bytes' | 'used_bytes' | 'created_at'
export type UserSortOrder = 'asc' | 'desc'

interface UsersTableProps {
  users: AdminUser[]
  currentUserId: number
  onEdit: (u: AdminUser) => void
  onResetPassword: (u: AdminUser) => void
  onToggleStatus: (u: AdminUser) => void
  onDelete: (u: AdminUser) => void
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  sort: UserSortField
  order: UserSortOrder
  onSortChange: (field: UserSortField) => void
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
      <Menu open={isOpen} onClose={close} items={items} title={user.display_name} align="right" anchorRef={anchor} />
    </div>
  )
}

/** Icono de dirección de orden para las cabeceras de tabla. */
function SortIcon({ field, sort, order }: { field: UserSortField; sort: UserSortField; order: UserSortOrder }) {
  if (field !== sort) return <ArrowUpDown size={14} className="ml-1 inline opacity-30" />
  return order === 'asc'
    ? <ArrowUp size={14} className="ml-1 inline text-primary" />
    : <ArrowDown size={14} className="ml-1 inline text-primary" />
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Tabla de usuarios (cards en móvil). */
export function UsersTable(props: UsersTableProps) {
  const { users, currentUserId, sort, order, onSortChange } = props

  const columns: { field: UserSortField; label: string }[] = [
    { field: 'username', label: 'Usuario' },
    { field: 'display_name', label: 'Nombre completo' },
    { field: 'role', label: 'Rol' },
    { field: 'status', label: 'Estado' },
    { field: 'max_upload_bytes', label: 'Subida máx.' },
    { field: 'used_bytes', label: 'Almacenamiento' },
    { field: 'created_at', label: 'Fecha de creación' },
  ]

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-hidden rounded-drive border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
              <th className="w-[1%] whitespace-nowrap pl-4 pr-6 py-2 font-medium">Avatar</th>
              {columns.map((col) => (
                <th
                  key={col.field}
                  className="py-2 font-medium cursor-pointer select-none hover:text-content-primary transition-colors"
                  onClick={() => onSortChange(col.field)}
                >
                  {col.label}
                  <SortIcon field={col.field} sort={sort} order={order} />
                </th>
              ))}
              <th className="w-12 py-2 pr-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
                <td className="w-[1%] whitespace-nowrap pl-4 pr-6 py-2">
                  <Avatar name={u.display_name} size={36} src={u.avatar_url} />
                </td>
                <td className="py-2 font-medium text-content-primary">
                  {u.username}
                </td>
                <td className="py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-content-primary">{u.display_name}</p>
                    <p className="truncate text-xs text-content-tertiary">{u.email}</p>
                  </div>
                </td>
                <td className="py-2"><RoleBadge role={u.role} /></td>
                <td className="py-2">
                  <span className={cn('text-xs font-medium', u.status === 'active' ? 'text-success' : 'text-danger')}>
                    {u.status === 'active' ? 'Activo' : 'Suspendido'}
                  </span>
                </td>
                <td className="py-2 text-content-secondary">
                  {u.max_upload_bytes > 0 ? formatBytes(u.max_upload_bytes) : 'Sin límite'}
                </td>
                <td className="py-2 pr-2">
                  <div className="w-40">
                    <ProgressBar value={usagePercent(u.used_bytes, u.quota_bytes)} size="sm" />
                    <p className="mt-1 text-xs text-content-tertiary">
                      {formatBytes(u.used_bytes)} / {formatBytes(u.quota_bytes)}
                    </p>
                  </div>
                </td>
                <td className="py-2 text-xs text-content-secondary whitespace-nowrap">
                  {formatDate(u.created_at)}
                </td>
                <td className="py-2 pr-2 text-right">
                  <UserMenu user={u} {...props} currentUserId={currentUserId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={props.page}
          limit={props.limit}
          total={props.total}
          onPageChange={props.onPageChange}
          onLimitChange={props.onLimitChange}
        />
      </div>

      {/* Móvil */}
      <div className="space-y-3 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-drive border border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              <Avatar name={u.display_name} size={40} src={u.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-content-primary">{u.display_name}</p>
                <p className="truncate text-xs text-content-tertiary">{u.email}</p>
                <p className="truncate text-xs text-primary font-medium">{u.username}</p>
              </div>
              <UserMenu user={u} {...props} currentUserId={currentUserId} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <RoleBadge role={u.role} />
              <span className={cn('text-xs font-medium', u.status === 'active' ? 'text-success' : 'text-danger')}>
                {u.status === 'active' ? 'Activo' : 'Suspendido'}
              </span>
              <span className="text-xs text-content-tertiary ml-auto">
                Subida máx: {u.max_upload_bytes > 0 ? formatBytes(u.max_upload_bytes) : 'Ilimitada'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-content-tertiary">{formatDate(u.created_at)}</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={usagePercent(u.used_bytes, u.quota_bytes)} size="sm" />
              <p className="mt-1 text-xs text-content-tertiary">
                {formatBytes(u.used_bytes)} / {formatBytes(u.quota_bytes)}
              </p>
            </div>
          </div>
        ))}
        <Pagination
          page={props.page}
          limit={props.limit}
          total={props.total}
          onPageChange={props.onPageChange}
          onLimitChange={props.onLimitChange}
        />
      </div>
    </>
  )
}
