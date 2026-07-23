import { Avatar } from './Avatar'
import { Tooltip } from './Tooltip'
import { cn } from '@shared/lib/cn'

export interface AvatarGroupProps {
  owners?: {
    username: string
    display_name: string
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
        <Tooltip key={owner.username} content={owner.display_name}>
          <div
            className={cn(
              'relative rounded-full ring-2 ring-surface transition-transform hover:z-10 hover:scale-110',
              overlap && idx > 0 && '-ml-2'
            )}
            style={overlap ? { zIndex: visibleOwners.length - idx } : undefined}
          >
            <Avatar name={owner.display_name} src={owner.avatar_url} size={size} />
          </div>
        </Tooltip>
      ))}
      {excess > 0 && (
        <div
          className={cn(
            'relative z-0 flex items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-content-secondary ring-2 ring-surface',
            overlap && '-ml-2'
          )}
          style={{ width: size, height: size }}
        >
          +{excess}
        </div>
      )}
    </div>
  )
}
