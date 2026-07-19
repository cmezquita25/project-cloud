import { LogIn, UploadCloud, Trash2, UserPlus, UserCog, UserX, KeyRound, Activity } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { formatRelative } from '@shared/lib/formatDate'
import type { ActivityItem } from '../types'

const ACTIONS: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  login: { label: 'inició sesión', icon: LogIn, className: 'text-primary' },
  upload: { label: 'subió un archivo', icon: UploadCloud, className: 'text-success' },
  delete: { label: 'envió a la papelera', icon: Trash2, className: 'text-danger' },
  'user.create': { label: 'creó un usuario', icon: UserPlus, className: 'text-success' },
  'user.update': { label: 'actualizó un usuario', icon: UserCog, className: 'text-primary' },
  'user.delete': { label: 'eliminó un usuario', icon: UserX, className: 'text-danger' },
  'user.password_reset': { label: 'restableció una contraseña', icon: KeyRound, className: 'text-warning' },
}

function detailText(item: ActivityItem): string {
  const d = item.details as Record<string, unknown> | null
  if (d && typeof d === 'object') {
    if (typeof d.name === 'string') return d.name
    if (typeof d.username === 'string') return d.username
  }
  return ''
}

/** Registro de actividad reciente. */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-content-tertiary">Sin actividad todavía.</p>
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-drive border border-border bg-surface">
      {items.map((item) => {
        const meta = ACTIONS[item.action] ?? { label: item.action, icon: Activity, className: 'text-content-tertiary' }
        const Icon = meta.icon
        const detail = detailText(item)
        return (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container', meta.className)}>
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-content-primary">
                <span className="font-medium">{item.actor}</span> {meta.label}
                {detail && <span className="text-content-secondary"> · {detail}</span>}
              </p>
              <p className="text-xs text-content-tertiary">
                {formatRelative(item.created_at)}
                {item.ip && ` · ${item.ip}`}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
