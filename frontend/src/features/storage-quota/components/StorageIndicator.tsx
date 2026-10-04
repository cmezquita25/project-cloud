import { Link } from 'react-router-dom'
import { ProgressBar } from '@shared/ui'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'

interface StorageIndicatorProps {
  usedBytes: number
  totalBytes: number
  onNavigate?: () => void
}

/** Barra de uso de almacenamiento (sidebar), estilo Google Drive. */
export function StorageIndicator({ usedBytes, totalBytes, onNavigate }: StorageIndicatorProps) {
  const percent = usagePercent(usedBytes, totalBytes)
  const tone = percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : 'primary'

  return (
    <Link
      to="/quota"
      onClick={onNavigate}
      // Tinte translúcido, sin `backdrop-filter`: vive dentro del sidebar, que
      // ya es glass, y un desenfoque anidado parpadea.
      className="block rounded-xl bg-slate-900/[0.03] px-4 py-3 ring-1 ring-inset ring-slate-900/[0.06] transition-colors hover:bg-slate-900/[0.06] dark:bg-white/[0.04] dark:ring-white/[0.07] dark:hover:bg-white/[0.08]"
    >
      <div className="mb-2.5 flex items-center gap-2 text-content-secondary">
        <span className="material-symbols-rounded text-[18px]">cloud</span>
        <span className="text-sm font-medium">Almacenamiento</span>
      </div>
      <ProgressBar value={percent} tone={tone} size="sm" />
      <p className="mt-2.5 text-xs text-content-tertiary">
        {formatBytes(usedBytes)} de {formatBytes(totalBytes)} usados
      </p>
    </Link>
  )
}
