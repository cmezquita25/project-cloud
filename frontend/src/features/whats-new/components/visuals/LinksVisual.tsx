import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Check, Clock, Copy, DownloadCloud, Eye, KeyRound, Link2, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MockWindow } from './MockWindow'

/** Las opciones que se van activando en la tarjeta del enlace. */
const OPTIONS: { icon: LucideIcon; label: string }[] = [
  { icon: Building2, label: 'Solo miembros' },
  { icon: KeyRound, label: 'Contraseña' },
  { icon: Clock, label: 'Caduca en 7 días' },
  { icon: ShieldCheck, label: 'Máx. 50 visitas' },
]

/** Tarjeta de enlace que se configura sola: opciones, copiar y contadores. */
export function LinksVisual() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % (OPTIONS.length + 3)), 1100)
    return () => window.clearInterval(id)
  }, [])

  const active = Math.min(step, OPTIONS.length)
  const copied = step === OPTIONS.length + 1
  const views = 12 + Math.max(0, step - OPTIONS.length) * 7

  return (
    <MockWindow dark title="Compartir — Propuesta Cliente X" className="max-w-[360px] bg-[#0b1020]">
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white">Presentación</span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] text-white/70">
            <Link2 size={9} /> Enlace
          </span>
        </div>

        <div className="flex min-h-[44px] flex-wrap gap-1.5">
          {OPTIONS.map(({ icon: Icon, label }, i) => (
            <motion.span
              key={label}
              animate={i < active ? { opacity: 1, scale: 1 } : { opacity: 0.25, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.07] px-2 py-1 text-[9px] font-medium text-white"
            >
              <Icon size={10} /> {label}
            </motion.span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[9px] text-white/70">
            drive.techmaleon.com.mx/s/7Gk2pQ9xLm3vRt8yBn4wZa
          </div>
          <span className="relative flex h-7 w-[74px] items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.08] text-[9px] font-semibold text-white">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? 'ok' : 'copy'}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                className="flex items-center gap-1"
              >
                {copied ? <Check size={10} className="text-emerald-300" /> : <Copy size={10} />}
                {copied ? 'Copiado' : 'Copiar'}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <div className="flex items-center gap-4 border-t border-white/10 pt-2.5 text-[9px] text-white/60">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Eye size={10} /> <motion.b key={views} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-semibold text-white">{views}</motion.b> / 50 visitas
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <DownloadCloud size={10} /> <b className="font-semibold text-white">4</b> descargas
          </span>
          <span className="ml-auto hidden whitespace-nowrap sm:inline">Abierto hace 2 min</span>
        </div>
      </div>
    </MockWindow>
  )
}
