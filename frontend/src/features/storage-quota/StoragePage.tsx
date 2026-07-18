import { Cloud } from 'lucide-react'
import { Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import { useQuota } from './hooks/useQuota'
import type { FileKind } from './services/quotaApi'

const KIND_META: Record<FileKind, { label: string; bar: string; dot: string }> = {
  image: { label: 'Imágenes', bar: 'bg-[#4285f4]', dot: 'bg-[#4285f4]' },
  video: { label: 'Videos', bar: 'bg-[#ea4335]', dot: 'bg-[#ea4335]' },
  audio: { label: 'Audio', bar: 'bg-[#fbbc04]', dot: 'bg-[#fbbc04]' },
  pdf: { label: 'PDF', bar: 'bg-[#d93025]', dot: 'bg-[#d93025]' },
  document: { label: 'Documentos', bar: 'bg-[#1a73e8]', dot: 'bg-[#1a73e8]' },
  spreadsheet: { label: 'Hojas de cálculo', bar: 'bg-[#188038]', dot: 'bg-[#188038]' },
  archive: { label: 'Comprimidos', bar: 'bg-[#e8710a]', dot: 'bg-[#e8710a]' },
  code: { label: 'Código', bar: 'bg-[#9334e6]', dot: 'bg-[#9334e6]' },
  other: { label: 'Otros', bar: 'bg-content-tertiary', dot: 'bg-content-tertiary' },
}

export function StoragePage() {
  const { data, loading } = useQuota()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-content-tertiary">
        <Spinner size={32} />
      </div>
    )
  }
  if (!data) {
    return <p className="text-sm text-content-tertiary">No se pudo cargar el almacenamiento.</p>
  }

  const percent = usagePercent(data.used_bytes, data.quota_bytes)

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-normal text-content-primary">Almacenamiento</h1>

      <div className="rounded-drive border border-border bg-surface p-6">
        <div className="mb-2 flex items-center gap-2 text-content-secondary">
          <Cloud size={20} />
          <span className="font-medium">
            {formatBytes(data.used_bytes)} de {formatBytes(data.quota_bytes)} usados
          </span>
        </div>

        {/* Barra segmentada por tipo */}
        <div className="mt-3 flex h-4 w-full overflow-hidden rounded-pill bg-surface-hover">
          {data.breakdown.map((b) => {
            const w = data.quota_bytes > 0 ? (b.bytes / data.quota_bytes) * 100 : 0
            return (
              <div
                key={b.kind}
                className={cn('h-full', KIND_META[b.kind].bar)}
                style={{ width: `${w}%` }}
                title={`${KIND_META[b.kind].label}: ${formatBytes(b.bytes)}`}
              />
            )
          })}
        </div>
        <p className="mt-2 text-xs text-content-tertiary">{percent.toFixed(1)}% usado</p>
      </div>

      {/* Desglose por tipo */}
      <div className="mt-4 rounded-drive border border-border bg-surface">
        {data.breakdown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-content-tertiary">
            Aún no has subido archivos.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.breakdown.map((b) => (
              <li key={b.kind} className="flex items-center gap-3 px-4 py-3">
                <span className={cn('h-3 w-3 shrink-0 rounded-full', KIND_META[b.kind].dot)} />
                <span className="flex-1 text-sm text-content-primary">{KIND_META[b.kind].label}</span>
                <span className="text-sm text-content-tertiary">{b.count} archivo(s)</span>
                <span className="w-24 text-right text-sm font-medium text-content-primary">
                  {formatBytes(b.bytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
