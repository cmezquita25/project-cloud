import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Download, FileText, Folder, HardDrive, Monitor } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { MockWindow } from './MockWindow'

const FOLDERS = [
  { icon: Monitor, label: 'Escritorio' },
  { icon: Folder, label: 'Documentos' },
  { icon: Download, label: 'Descargas' },
  { icon: HardDrive, label: 'Proyectos' },
]

/**
 * Ciclo: clic en «Descargar» → ventana «Guardar como» → se elige la carpeta →
 * progreso → guardado.
 */
export function SaveAsVisual() {
  // 0 archivo · 1 diálogo · 2 carpeta elegida · 3 guardando · 4 guardado
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const durations = [1300, 1100, 900, 1300, 1600]
    const id = window.setTimeout(() => setPhase((p) => (p + 1) % 5), durations[phase])
    return () => window.clearTimeout(id)
  }, [phase])

  return (
    <div className="relative flex h-[250px] w-full max-w-[380px] items-center justify-center">
      {/* Fila del archivo en la plataforma */}
      <MockWindow dark title="Mi unidad" className={cn('absolute top-0 bg-[#0b1020] transition-opacity duration-300', phase >= 1 && phase <= 3 && 'opacity-40')}>
        <div className="flex items-center gap-2.5 px-3 py-3">
          <FileText size={16} className="text-rose-300" />
          <span className="flex-1 text-[11px] font-medium text-white">Informe trimestral.pdf</span>
          <span className="text-[9px] text-white/50">2.4 MB</span>
          <motion.span
            animate={phase === 0 ? { scale: [1, 1.08, 1], boxShadow: ['0 0 0 0 rgb(96 165 250 / 0)', '0 0 0 6px rgb(96 165 250 / 0.25)', '0 0 0 0 rgb(96 165 250 / 0)'] } : { scale: 1 }}
            transition={{ duration: 1.1, repeat: phase === 0 ? Infinity : 0 }}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-gradient-start to-gradient-end px-2.5 py-1 text-[9px] font-semibold text-btn-text"
          >
            <Download size={10} /> Descargar
          </motion.span>
        </div>
      </MockWindow>

      {/* Ventana «Guardar como» del sistema */}
      <AnimatePresence>
        {phase >= 1 && phase <= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[86px] w-[88%]"
          >
            <MockWindow title="Guardar como" className="bg-[#f4f6fb] dark:bg-[#f4f6fb] [&_*]:!text-slate-700">
              <div className="flex">
                <div className="w-[38%] space-y-0.5 border-r border-slate-200 p-2">
                  {FOLDERS.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className={cn(
                        'flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px]',
                        phase >= 2 && label === 'Documentos' ? 'bg-blue-100 font-semibold' : ''
                      )}
                    >
                      <Icon size={10} /> {label}
                    </div>
                  ))}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2 p-2.5">
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wide">Nombre</span>
                    <div className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[9px]">Informe trimestral.pdf</div>
                  </div>
                  {phase === 3 ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <motion.div className="h-full rounded-full bg-blue-500" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.1 }} />
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1.5">
                      <span className="rounded border border-slate-300 px-2 py-0.5 text-[9px]">Cancelar</span>
                      <span className={cn('rounded px-2 py-0.5 text-[9px] font-semibold', phase >= 2 ? 'bg-blue-600 [&]:!text-white' : 'bg-slate-300')}>Guardar</span>
                    </div>
                  )}
                </div>
              </div>
            </MockWindow>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmación */}
      <AnimatePresence>
        {phase === 4 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-[11px] font-medium text-emerald-200"
          >
            <CheckCircle2 size={14} /> Guardado en Documentos
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
