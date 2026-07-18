import { Cloud } from 'lucide-react'
import { Button, ProgressBar } from '@shared/ui'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'

interface StorageIndicatorProps {
  usedBytes: number
  totalBytes: number
}

/**
 * Barra de uso de almacenamiento (sidebar), estilo Google Drive.
 * En Fase 6 se conectará al endpoint `GET /quota`; aquí recibe datos por props.
 */
export function StorageIndicator({ usedBytes, totalBytes }: StorageIndicatorProps) {
  const percent = usagePercent(usedBytes, totalBytes)
  const tone = percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : 'primary'

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center gap-2 text-content-secondary">
        <Cloud size={18} />
        <span className="text-sm font-medium">Almacenamiento</span>
      </div>
      <ProgressBar value={percent} tone={tone} size="sm" />
      <p className="mt-2 text-xs text-content-tertiary">
        {formatBytes(usedBytes)} de {formatBytes(totalBytes)} usados
      </p>
      <Button variant="secondary" size="sm" className="mt-3 w-full">
        Ampliar almacenamiento
      </Button>
    </div>
  )
}
