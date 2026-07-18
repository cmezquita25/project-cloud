import { useRef } from 'react'
import { MoreVertical } from 'lucide-react'
import { IconButton, Menu } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { buildItemMenu } from './itemMenu'
import type { DriveItem, ItemAction } from '../types'

interface ItemActionsMenuProps {
  item: DriveItem
  onAction: (item: DriveItem, action: ItemAction) => void
  size?: 'sm' | 'md'
}

/** Botón ⋮ que abre el menú contextual de un elemento (dropdown/bottom sheet). */
export function ItemActionsMenu({ item, onAction, size = 'sm' }: ItemActionsMenuProps) {
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
        items={buildItemMenu(item, (a) => onAction(item, a))}
        title={item.name}
        align="right"
        anchorRef={anchor}
      />
    </div>
  )
}
