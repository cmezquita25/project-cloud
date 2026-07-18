import {
  HardDrive,
  Clock,
  Star,
  Trash2,
  Shield,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Solo visible para administradores. */
  adminOnly?: boolean
}

/** Navegación principal del sidebar (clon de Google Drive). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Mi unidad', icon: HardDrive },
  { to: '/recent', label: 'Recientes', icon: Clock },
  { to: '/starred', label: 'Destacados', icon: Star },
  { to: '/trash', label: 'Papelera', icon: Trash2 },
  { to: '/admin', label: 'Administración', icon: Shield, adminOnly: true },
]
