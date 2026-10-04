import { APP_NAME, getVersionLabel } from '@shared/config/version'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { ReportBugDialog } from '@features/support/components/ReportBugDialog'
import { useState } from 'react'
import { motion } from 'framer-motion'

const LEGAL_LINKS = ['Legal', 'Privacidad', 'Docs']

interface FooterProps {
  /**
   * `bar` (escritorio): barra glass fija abajo, en una fila.
   * `stacked` (móvil): va al final del scroll, sin fondo de barra y en una
   * sola columna centrada, fila por fila (como la barra inferior del footer
   * de la landing). Comprimido en una barra robaba espacio en pantallas
   * pequeñas y los textos quedaban apretados.
   */
  variant?: 'bar' | 'stacked'
}

/**
 * Pie de página global de la app: copyright del año en curso, versión,
 * autoría y enlaces informativos (estáticos por ahora).
 */
export function Footer({ variant = 'bar' }: FooterProps) {
  const settings = usePlatformSettings()
  const owner = settings?.organization_name?.trim() || APP_NAME
  const year = new Date().getFullYear()
  const [reportOpen, setReportOpen] = useState(false)

  const links = (
    <>
      {LEGAL_LINKS.map((label) => (
        <span key={label} className="cursor-default transition-colors hover:text-content-secondary">
          {label}
        </span>
      ))}
      <button
        onClick={() => setReportOpen(true)}
        className="text-primary hover:underline transition-colors focus-visible:outline-focus"
      >
        Reportar un problema
      </button>
    </>
  )

  const dialog = reportOpen && <ReportBugDialog isOpen={reportOpen} onClose={() => setReportOpen(false)} />

  if (variant === 'stacked') {
    return (
      <footer className="shrink-0 border-t border-slate-900/[0.06] px-5 pb-8 pt-7 text-xs text-content-tertiary dark:border-white/[0.06]">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="leading-relaxed">
            © {year} {owner}.
            <br />
            Todos los derechos reservados.
          </p>
          <p className="flex flex-col items-center gap-1">
            <span className="font-mono text-[11px] text-content-tertiary/80">{getVersionLabel()}</span>
            <span>Desarrollado por Carlos Mezquita Alvarado</span>
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">{links}</nav>
        </div>
        {dialog}
      </footer>
    )
  }

  return (
    <motion.footer
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="glass shrink-0 border-x-0 border-b-0 px-4 py-2.5 text-xs text-content-tertiary sm:px-6"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center sm:justify-start sm:text-left">
          <span>© {year} {owner}. Todos los derechos reservados.</span>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span>{getVersionLabel()}</span>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span>Desarrollado por Carlos Mezquita Alvarado</span>
        </p>

        <nav className="flex shrink-0 items-center gap-4">{links}</nav>
      </div>

      {dialog}
    </motion.footer>
  )
}
