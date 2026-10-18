import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Una diapositiva del modal de novedades. */
export interface WhatsNewSlide {
  id: string
  /** Etiqueta corta sobre el título («Personalización», «Seguridad»…). */
  badge: string
  icon: LucideIcon
  title: string
  description: string
  /** Lista breve opcional bajo la descripción. */
  bullets?: string[]
  /** Nota pequeña al pie del texto (p. ej. compatibilidad del navegador). */
  footnote?: string
  /** Reproducción visual del cambio (no es una captura: es un mini-componente vivo). */
  visual: ComponentType
  /** Botón opcional que lleva a la función (cierra el modal y navega). */
  action?: { label: string; to: string }
}

/** Las novedades de una versión. */
export interface WhatsNewRelease {
  /** «2.6»: se muestra una vez por cada versión menor. */
  id: string
  title: string
  slides: WhatsNewSlide[]
}
