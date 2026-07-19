import {
  HardDrive,
  Clock,
  Star,
  Trash2,
  LayoutDashboard,
  Users,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Solo visible para administradores. */
  adminOnly?: boolean
  /** Solo visible si el usuario tiene acceso a la unidad compartida. */
  requiresAssets?: boolean
}

export interface NavGroup {
  /** Etiqueta del grupo (encabezado del sidebar). */
  label: string
  items: NavItem[]
}

/**
 * Navegación principal del sidebar, agrupada (clon de Google Drive):
 *  - Mi unidad: espacio personal y sus vistas.
 *  - Compartido: recursos compartidos entre usuarios.
 *  - Sistema: administración de la plataforma.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Mi unidad',
    items: [
      { to: '/', label: 'Mi unidad', icon: HardDrive, end: true },
      { to: '/recent', label: 'Recientes', icon: Clock },
      { to: '/starred', label: 'Destacados', icon: Star },
      { to: '/trash', label: 'Papelera', icon: Trash2 },
    ],
  },
  {
    label: 'Compartido',
    items: [
      { to: '/assets', label: 'Unidad compartida', icon: HardDrive, requiresAssets: true },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/admin', label: 'Panel', icon: LayoutDashboard, end: true, adminOnly: true },
      { to: '/admin/users', label: 'Usuarios', icon: Users, adminOnly: true },
      { to: '/admin/activity', label: 'Registros de auditoría', icon: ScrollText, adminOnly: true },
      { to: '/admin/settings', label: 'Configuración', icon: Settings, adminOnly: true },
    ],
  },
]
