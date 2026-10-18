import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Maximize2, Smartphone } from 'lucide-react'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { loadLogo, qrSvg } from '@features/share-links/lib/qr'
import { MockWindow } from './MockWindow'

/**
 * QR real (el mismo generador de la plataforma, con el logo que configuró el
 * admin) con una línea de escaneo y los formatos de descarga.
 */
export function QrVisual() {
  const settings = usePlatformSettings()
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadLogo(settings?.qr_logo_url)
      .then((logo) => qrSvg(`${window.location.origin}/s/Novedades2026QrDemo00`, logo))
      .then((out) => alive && setSvg(out))
      .catch(() => alive && setSvg(null))
    return () => {
      alive = false
    }
  }, [settings?.qr_logo_url])

  return (
    <div className="flex w-full items-center justify-center gap-5">
      <MockWindow dark title="Enlace y QR" className="max-w-[260px] bg-[#0b1020]">
        <div className="flex flex-col items-center gap-3 p-4">
          <div className="relative h-36 w-36 overflow-hidden rounded-xl bg-white p-1.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)]">
            {svg && <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
            {/* Línea de escaneo */}
            <motion.div
              className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-emerald-400/35 to-transparent"
              initial={{ top: '-20%' }}
              animate={{ top: ['-20%', '100%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
            />
          </div>
          <div className="flex w-full items-center justify-center gap-1.5">
            {[
              { icon: Maximize2, label: 'Ampliar' },
              { icon: Download, label: 'PNG' },
              { icon: Download, label: 'SVG' },
            ].map(({ icon: Icon, label }, i) => (
              <motion.span
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.12 }}
                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.06] px-2 py-1 text-[9px] font-medium text-white/80"
              >
                <Icon size={10} /> {label}
              </motion.span>
            ))}
          </div>
        </div>
      </MockWindow>

      {/* Teléfono que lo escanea */}
      <motion.div
        initial={{ opacity: 0, x: 16, rotate: 6 }}
        animate={{ opacity: 1, x: 0, rotate: 6 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden h-44 w-24 flex-col items-center justify-center gap-2 rounded-[1.4rem] border-[3px] border-white/20 bg-[#05070f] shadow-[0_20px_50px_-15px_rgb(0_0_0/0.7)] sm:flex"
        aria-hidden="true"
      >
        <Smartphone size={18} className="text-white/40" />
        <motion.span
          className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[8px] font-semibold text-emerald-300"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          Abriendo…
        </motion.span>
      </motion.div>
    </div>
  )
}
