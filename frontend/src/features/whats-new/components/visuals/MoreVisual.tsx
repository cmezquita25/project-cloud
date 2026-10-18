import { motion } from 'framer-motion'
import { FileArchive, FolderOpen, Gauge, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ITEMS: { icon: LucideIcon; label: string; tint: string }[] = [
  { icon: FileArchive, label: 'Carpetas en ZIP', tint: 'from-sky-400/30 to-blue-500/10' },
  { icon: LockKeyhole, label: 'Carpetas privadas', tint: 'from-violet-400/30 to-fuchsia-500/10' },
  { icon: Users, label: 'Permisos por invitación', tint: 'from-emerald-400/30 to-teal-500/10' },
  { icon: FolderOpen, label: 'Carpetas públicas por enlace', tint: 'from-amber-300/30 to-orange-500/10' },
  { icon: Gauge, label: 'Carga más rápida', tint: 'from-cyan-300/30 to-sky-500/10' },
  { icon: ShieldCheck, label: 'Parches de seguridad', tint: 'from-rose-400/30 to-red-500/10' },
]

/** Mosaico de las demás mejoras, apareciendo en cascada. */
export function MoreVisual() {
  return (
    <div className="grid w-full max-w-[380px] grid-cols-2 gap-2.5 sm:grid-cols-3" aria-hidden="true">
      {ITEMS.map(({ icon: Icon, label, tint }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.08 * i, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={`flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-xl border border-white/10 bg-gradient-to-br ${tint} p-3`}
        >
          <motion.span
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white"
          >
            <Icon size={16} />
          </motion.span>
          <span className="text-[11px] font-medium leading-tight text-white">{label}</span>
        </motion.div>
      ))}
    </div>
  )
}
