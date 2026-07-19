import { Building2, Palette, Mail, FileText, ShieldCheck, type LucideIcon } from 'lucide-react'

export interface SettingsNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** Secciones de Configuración (pestañas verticales del panel de administración). */
export const SETTINGS_NAV: SettingsNavItem[] = [
  { to: '/admin/settings', label: 'General', icon: Building2, end: true },
  { to: '/admin/settings/appearance', label: 'Configuración visual', icon: Palette },
  { to: '/admin/settings/email', label: 'Configuración del SMTP', icon: Mail },
  { to: '/admin/settings/email-templates', label: 'Plantillas de correo', icon: FileText },
  { to: '/admin/settings/access', label: 'Acceso y permisos', icon: ShieldCheck },
]
