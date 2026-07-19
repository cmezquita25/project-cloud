import { Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import { useQuota } from './hooks/useQuota'
import { KIND_META } from './kindMeta'

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
          <span className="material-symbols-rounded text-[20px]">cloud</span>
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
