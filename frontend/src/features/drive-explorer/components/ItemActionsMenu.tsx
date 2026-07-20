import { useRef } from 'react'
import { MoreVertical } from 'lucide-react'
import { IconButton, Menu } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { buildItemMenu } from './itemMenu'
import type { DriveItem, ItemAction } from '../types'
import type { ExplorerCapabilities } from '../adapters/types'

interface ItemActionsMenuProps {
  item: DriveItem
  onAction: (item: DriveItem, action: ItemAction) => void
  size?: 'sm' | 'md'
  capabilities?: ExplorerCapabilities
}

const DEFAULT_CAPS: ExplorerCapabilities = {
  canWrite: true,
  canStar: true,
  canCopy: true,
  canMove: true,
  canRename: true,
  canDuplicate: true,
  canDownload: true,
  canDelete: true,
  canShare: true,
}

/** Botón ⋮ que abre el menú contextual de un elemento (dropdown/bottom sheet). */
export function ItemActionsMenu({ item, onAction, size = 'sm', capabilities = DEFAULT_CAPS }: ItemActionsMenuProps) {
  const { isOpen, toggle, close } = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)

  return (
    <div ref={anchor} className="relative">
      <IconButton
        icon={MoreVertical}
        label="Más acciones"
        size={size}
        active={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
      />
      <Menu
        open={isOpen}
        onClose={close}
        items={buildItemMenu(item, (a) => onAction(item, a), capabilities)}
        title={item.name}
        align="right"
        anchorRef={anchor}
      />
    </div>
  )
}
