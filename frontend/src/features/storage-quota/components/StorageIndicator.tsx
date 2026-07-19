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
      className="block rounded-xl bg-surface-container px-4 py-3 transition-colors hover:bg-surface-hover"
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
