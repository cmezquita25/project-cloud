import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, HardDrive, Plus, Star, Trash2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { MockWindow } from './MockWindow'

/**
 * Paleta de cada estilo en modo oscuro (los mismos tonos de index.css). Se
 * aplica solo dentro de esta vista previa: la plataforma no cambia.
 */
const THEMES = [
  {
    id: 'blizzard',
    name: 'Blizzard',
    tagline: 'Azules intensos y cian',
    canvas: '#000409',
    sidebar: '#020812',
    surface: '#081630',
    primary: '#60a5fa',
    from: '#1d4ed8',
    to: '#38bdf8',
    glow: '#2563eb',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    tagline: 'Azul que pasa a morado',
    canvas: '#020617',
    sidebar: '#0f172a',
    surface: '#1e293b',
    primary: '#a8c7fa',
    from: '#1a73e8',
    to: '#9333ea',
    glow: '#7c3aed',
  },
  {
    id: 'supernova',
    name: 'Supernova',
    tagline: 'Rojos con toques morados',
    canvas: '#020001',
    sidebar: '#080203',
    surface: '#1c060c',
    primary: '#fda4af',
    from: '#e11d48',
    to: '#7e22ce',
    glow: '#be123c',
  },
  {
    id: 'techmaleon',
    name: 'Techmaleon',
    tagline: 'Verdes que pasan a azules',
    canvas: '#010605',
    sidebar: '#03100d',
    surface: '#06261a',
    primary: '#34e88c',
    from: '#00c950',
    to: '#1e48b0',
    glow: '#05df72',
  },
] as const

/** Mini plataforma que va cambiando de estilo; los chips permiten elegir uno. */
export function ThemesVisual() {
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(true)
  const t = THEMES[index]!

  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % THEMES.length), 2400)
    return () => window.clearInterval(id)
  }, [auto])

  const cards = ['Presentación.pdf', 'Logo.png', 'Contrato.docx']

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <MockWindow dark title="Mi unidad" style={{ background: t.canvas, transition: 'background 500ms ease' }}>
        <div className="relative flex h-[188px] overflow-hidden sm:h-[210px]">
          {/* Halo de marca */}
          <div
            className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: t.glow, transition: 'background 500ms ease' }}
          />
          {/* Barra lateral */}
          <div className="relative z-10 flex w-[30%] flex-col gap-1.5 p-2.5" style={{ background: t.sidebar, transition: 'background 500ms ease' }}>
            <div
              className="mb-1 flex h-6 w-16 items-center justify-center gap-1 rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundImage: `linear-gradient(90deg, ${t.from}, ${t.to})` }}
            >
              <Plus size={10} /> Nuevo
            </div>
            {[
              { icon: HardDrive, label: 'Mi unidad', active: true },
              { icon: Clock, label: 'Recientes' },
              { icon: Star, label: 'Destacados' },
              { icon: Trash2, label: 'Papelera' },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px]"
                style={active ? { background: `${t.primary}22`, color: t.primary } : { color: 'rgb(255 255 255 / 0.55)' }}
              >
                <Icon size={10} /> {label}
              </div>
            ))}
          </div>
          {/* Contenido */}
          <div className="relative z-10 flex flex-1 flex-col gap-2.5 p-3">
            <div className="text-[11px] font-semibold text-white">
              Te damos la bienvenida a{' '}
              <span style={{ backgroundImage: `linear-gradient(90deg, ${t.primary}, ${t.to})`, WebkitBackgroundClip: 'text', color: 'transparent' }}>
                tu espacio
              </span>
            </div>
            <div className="h-5 rounded-full border border-white/10 bg-white/[0.04]" />
            <div className="grid grid-cols-3 gap-2">
              {cards.map((name) => (
                <div key={name} className="overflow-hidden rounded-lg border border-white/10" style={{ background: t.surface, transition: 'background 500ms ease' }}>
                  <div className="h-10 sm:h-12" style={{ backgroundImage: `linear-gradient(135deg, ${t.from}55, ${t.to}33)` }} />
                  <div className="truncate px-1.5 py-1 text-[8px] text-white/70">{name}</div>
                </div>
              ))}
            </div>
            <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                key={t.id}
                className="h-full rounded-full"
                style={{ backgroundImage: `linear-gradient(90deg, ${t.from}, ${t.to})` }}
                initial={{ width: '15%' }}
                animate={{ width: '68%' }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>
      </MockWindow>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {THEMES.map((theme, i) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => {
              setAuto(false)
              setIndex(i)
            }}
            aria-pressed={i === index}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
              i === index
                ? 'border-white/30 bg-white/15 text-white shadow-[0_6px_20px_-8px_rgb(0_0_0/0.6)]'
                : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10 hover:text-white'
            )}
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }} />
            {theme.name}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={t.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="-mt-2 text-[11px] text-white/60"
        >
          {t.name} · {t.tagline}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
