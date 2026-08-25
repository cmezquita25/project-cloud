import { Avatar } from './Avatar'
import { Tooltip } from './Tooltip'
import { cn } from '@shared/lib/cn'

export interface AvatarGroupProps {
  owners?: {
    username?: string
    display_name: string
    email?: string
    avatar_url: string | null
  }[]
  max?: number
  size?: number
  overlap?: boolean
  className?: string
}

export function AvatarGroup({ owners = [], max = 4, size = 28, overlap = true, className }: AvatarGroupProps) {
  if (!owners || owners.length === 0) return null

  const visibleOwners = owners.slice(0, max)
  const excess = owners.length - max

  return (
    <div className={cn('flex items-center', !overlap && 'flex-wrap gap-2', className)}>
      {visibleOwners.map((owner, idx) => (
        <Tooltip key={owner.username || owner.email || idx} content={owner.display_name}>
          <div
            className={cn(
              'relative shrink-0 rounded-full ring-2 ring-surface transition-transform hover:z-20 hover:scale-110',
              overlap && idx > 0 && '-ml-2'
            )}
          >
            <Avatar name={owner.display_name} src={owner.avatar_url} size={size} />
          </div>
        </Tooltip>
      ))}
      {excess > 0 && (
        <Tooltip content={`${excess} usuario${excess > 1 ? 's' : ''} más`}>
          <div
            className={cn(
              'relative shrink-0 flex items-center justify-center rounded-full bg-surface-container text-xs font-semibold text-content-secondary ring-2 ring-surface transition-transform hover:z-20 hover:scale-110',
              overlap && '-ml-2'
            )}
            style={{ width: size, height: size }}
          >
            +{excess}
          </div>
        </Tooltip>
      )}
    </div>
  )
}
