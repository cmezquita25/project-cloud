import { useRef } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { IconButton, Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { useTheme, type ThemeMode } from '@app/providers/ThemeProvider'

/** Selector de tema (claro / oscuro / sistema) para la topbar. */
export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme()
  const { isOpen, toggle, close } = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)

  const items: MenuItem[] = (
    [
      { id: 'light', label: 'Claro', icon: Sun },
      { id: 'dark', label: 'Oscuro', icon: Moon },
      { id: 'system', label: 'Sistema', icon: Monitor },
    ] as const
  ).map((opt) => ({
    ...opt,
    onSelect: () => setMode(opt.id as ThemeMode),
    disabled: mode === opt.id,
  }))

  const Icon = resolved === 'dark' ? Moon : Sun

  return (
    <div ref={anchor} className="relative">
      <IconButton icon={Icon} label="Cambiar tema" onClick={toggle} active={isOpen} />
      <Menu open={isOpen} onClose={close} items={items} title="Tema" align="right" />
    </div>
  )
}
