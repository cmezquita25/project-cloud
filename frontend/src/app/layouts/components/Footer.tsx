import { APP_NAME, getVersionLabel } from '@shared/config/version'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'

const LEGAL_LINKS = ['Legal', 'Privacidad', 'Docs']

/**
 * Pie de página global de la app. A la izquierda: copyright del año en curso,
 * versión y autoría. A la derecha: enlaces informativos (estáticos por ahora).
 * Responsive: en móvil se apila y centra; en escritorio va en una fila.
 */
export function Footer() {
  const settings = usePlatformSettings()
  const owner = settings?.organization_name?.trim() || APP_NAME
  const year = new Date().getFullYear()

  return (
    <footer className="shrink-0 border-t border-border bg-surface px-4 py-2.5 text-xs text-content-tertiary sm:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center sm:justify-start sm:text-left">
          <span>© {year} {owner}. Todos los derechos reservados.</span>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span>{getVersionLabel()}</span>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span>Powered by Carlos Mezquita Alvarado</span>
        </p>

        <nav className="flex shrink-0 items-center gap-4">
          {LEGAL_LINKS.map((label) => (
            <span key={label} className="cursor-default transition-colors hover:text-content-secondary">
              {label}
            </span>
          ))}
        </nav>
      </div>
    </footer>
  )
}
