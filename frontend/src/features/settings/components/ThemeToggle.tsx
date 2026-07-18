import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@shared/ui'
import { useTheme } from '@app/providers/ThemeProvider'

/**
 * Alterna el tema con un solo clic entre claro y oscuro (y persiste la elección).
 * Al entrar sin preferencia guardada se usa la del sistema; si hay una guardada,
 * se recuerda. El icono muestra a qué modo cambiará el próximo clic.
 */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={toggle}
    />
  )
}
