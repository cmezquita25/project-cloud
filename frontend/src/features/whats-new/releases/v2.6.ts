import { HardDriveDownload, Link2, Palette, QrCode, Sparkles } from 'lucide-react'
import type { WhatsNewRelease } from '../types'
import { ThemesVisual } from '../components/visuals/ThemesVisual'
import { QrVisual } from '../components/visuals/QrVisual'
import { LinksVisual } from '../components/visuals/LinksVisual'
import { SaveAsVisual } from '../components/visuals/SaveAsVisual'
import { MoreVisual } from '../components/visuals/MoreVisual'

/** Novedades de la 2.6 (resumen de lo nuevo desde la 2.3). */
export const release26: WhatsNewRelease = {
  id: '2.6',
  title: 'Novedades de la versión 2.6',
  slides: [
    {
      id: 'themes',
      badge: 'Personalización',
      icon: Palette,
      title: 'Elige tu propio estilo',
      description:
        'Ahora puedes personalizar los colores de tu interfaz con Blizzard, Nebula, Supernova o Techmaleon, o seguir usando el estilo de la plataforma. El cambio es solo para ti.',
      visual: ThemesVisual,
      action: { label: 'Personalizar apariencia', to: '/profile#apariencia' },
    },
    {
      id: 'qr',
      badge: 'Compartir',
      icon: QrCode,
      title: 'Un código QR para cada enlace',
      description:
        'Cualquier archivo o carpeta que compartas tiene su QR, listo para mostrar en pantalla completa o descargar en PNG o SVG. Ideal para presentaciones, eventos y material impreso.',
      visual: QrVisual,
    },
    {
      id: 'links',
      badge: 'Compartir',
      icon: Link2,
      title: 'Enlaces hechos a tu medida',
      description:
        'Decide quién entra, protégelos con contraseña, ponles fecha de caducidad o un límite de visitas, y mira cuántas veces se abrieron. Revócalos cuando quieras.',
      visual: LinksVisual,
      action: { label: 'Ver mis enlaces', to: '/links' },
    },
    {
      id: 'save-as',
      badge: 'Descargas',
      icon: HardDriveDownload,
      title: 'Tú decides dónde se guarda',
      description:
        'Al descargar, eliges la carpeta de tu equipo donde quedará el archivo. Si descargas varios a la vez, eliges la carpeta una sola vez.',
      footnote: 'Disponible en Chrome y Edge. En otros navegadores, la descarga funciona como siempre.',
      visual: SaveAsVisual,
    },
    {
      id: 'more',
      badge: 'Y mucho más',
      icon: Sparkles,
      title: 'Más rápida, más segura',
      description: 'También llegaron otros cambios, mejoras, optimizaciones y parches de seguridad para que todo funcione mejor.',
      visual: MoreVisual,
    },
  ],
}
