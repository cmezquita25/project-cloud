import Chart from 'react-apexcharts'
import {
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Upload,
  Files,
  PieChart,
  TrendingUp,
  Image,
  Film,
  Music,
  FileText,
  FileSpreadsheet,
  Presentation,
  Archive,
  Code2,
  Palette,
  Cpu,
  File,
  type LucideIcon,
} from 'lucide-react'
import { Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import { useTheme } from '@app/providers/ThemeProvider'
import { useQuota } from './hooks/useQuota'
import { KIND_META } from './kindMeta'
import type { FileKind } from './services/quotaApi'

const KIND_ICONS: Record<FileKind, LucideIcon> = {
  image: Image,
  video: Film,
  audio: Music,
  pdf: FileText,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: Archive,
  code: Code2,
  design: Palette,
  executable: Cpu,
  other: File,
}

const KIND_COLORS: Record<FileKind, { bg: string; text: string; hex: string }> = {
  image: { bg: 'bg-blue-500/15', text: 'text-blue-500', hex: '#3b82f6' },
  video: { bg: 'bg-red-500/15', text: 'text-red-500', hex: '#ef4444' },
  audio: { bg: 'bg-amber-500/15', text: 'text-amber-500', hex: '#f59e0b' },
  pdf: { bg: 'bg-rose-500/15', text: 'text-rose-500', hex: '#f43f5e' },
  document: { bg: 'bg-indigo-500/15', text: 'text-indigo-500', hex: '#6366f1' },
  spreadsheet: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', hex: '#10b981' },
  presentation: { bg: 'bg-orange-500/15', text: 'text-orange-500', hex: '#f97316' },
  archive: { bg: 'bg-amber-600/15', text: 'text-amber-600', hex: '#d97706' },
  code: { bg: 'bg-purple-500/15', text: 'text-purple-500', hex: '#a855f7' },
  design: { bg: 'bg-pink-500/15', text: 'text-pink-500', hex: '#ec4899' },
  executable: { bg: 'bg-slate-500/15', text: 'text-slate-500', hex: '#64748b' },
  other: { bg: 'bg-gray-500/15', text: 'text-gray-400', hex: '#9ca3af' },
}

export function StoragePage() {
  const { data, loading } = useQuota()
  const { resolved: theme } = useTheme()
  const isDark = theme === 'dark'

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-content-tertiary">
        <Spinner size={36} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldAlert size={48} className="mx-auto text-danger opacity-80" />
        <h2 className="mt-4 text-lg font-medium text-content-primary">No se pudo cargar el almacenamiento</h2>
        <p className="mt-2 text-sm text-content-secondary">
          Intenta recargar la página o comunicarte con el administrador del sistema.
        </p>
      </div>
    )
  }

  const percent = usagePercent(data.used_bytes, data.quota_bytes)
  const freeBytes = Math.max(0, data.quota_bytes - data.used_bytes)
  const totalFiles = data.breakdown.reduce((acc, curr) => acc + curr.count, 0)
  
  // Categoría principal (mayor consumo de almacenamiento)
  const dominantCategory = [...data.breakdown].sort((a, b) => b.bytes - a.bytes)[0] ?? null

  // Configuración de la gráfica Donut
  const chartSeries = data.breakdown.map((b) => b.bytes)
  const chartLabels = data.breakdown.map((b) => KIND_META[b.kind]?.label ?? b.kind)
  const chartColors = data.breakdown.map((b) => KIND_COLORS[b.kind]?.hex ?? '#9ca3af')

  // Estado del almacenamiento
  let statusBadge = {
    label: 'Óptimo',
    color: 'text-success bg-success/10 border-success/20',
    icon: CheckCircle2,
    description: 'Tienes suficiente capacidad disponible para tus archivos.',
  }
  if (percent >= 90) {
    statusBadge = {
      label: 'Límite Crítico',
      color: 'text-danger bg-danger/10 border-danger/20',
      icon: ShieldAlert,
      description: 'Estás a punto de agotar tu almacenamiento. Libera espacio.',
    }
  } else if (percent >= 75) {
    statusBadge = {
      label: 'Atención',
      color: 'text-warning bg-warning/10 border-warning/20',
      icon: AlertTriangle,
      description: 'Has utilizado más del 75% de tu cuota de espacio.',
    }
  }
  const StatusIcon = statusBadge.icon

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal text-content-primary">Almacenamiento personal</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Monitorea el uso de tu cuota de disco y la distribución por tipo de archivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary shadow-sm">
            <Cloud size={14} className="text-primary" />
            Cuota activa: {formatBytes(data.quota_bytes)}
          </span>
        </div>
      </div>

      {/* Bento Grid Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        
        {/* Bento Card 1: Tarjeta Principal de Resumen (2 cols en lg) */}
        <div className="lg:col-span-2 rounded-drive border border-border bg-surface p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <HardDrive size={20} />
                </span>
                <span className="text-sm font-medium text-content-secondary">Espacio Total</span>
              </div>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', statusBadge.color)}>
                <StatusIcon size={12} />
                {statusBadge.label}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-tight text-content-primary">
                {formatBytes(data.used_bytes)}
              </span>
              <span className="text-base text-content-tertiary">
                de {formatBytes(data.quota_bytes)}
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs text-content-secondary font-medium">
                <span>Progreso de ocupación</span>
                <span>{percent.toFixed(1)}%</span>
              </div>

              {/* Barra segmentada multicolor */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-hover p-0.5">
                {data.breakdown.length === 0 ? (
                  <div className="h-full w-full rounded-full bg-content-tertiary/20" />
                ) : (
                  data.breakdown.map((b) => {
                    const w = data.quota_bytes > 0 ? (b.bytes / data.quota_bytes) * 100 : 0
                    if (w <= 0) return null
                    return (
                      <div
                        key={b.kind}
                        className={cn('h-full first:rounded-l-full last:rounded-r-full transition-all duration-300', KIND_META[b.kind]?.bar ?? 'bg-content-tertiary')}
                        style={{ width: `${w}%` }}
                        title={`${KIND_META[b.kind]?.label}: ${formatBytes(b.bytes)}`}
                      />
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-content-tertiary block">Disponible libre</span>
              <span className="text-sm font-medium text-success mt-0.5 block">{formatBytes(freeBytes)}</span>
            </div>
            <div>
              <span className="text-content-tertiary block">Límite por subida</span>
              <span className="text-sm font-medium text-content-primary mt-0.5 block">
                {data.max_upload_bytes > 0 ? formatBytes(data.max_upload_bytes) : 'Sin límite'}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Card 2: Distribución por Gráfico de Dona (2 cols en lg) */}
        <div className="lg:col-span-2 rounded-drive border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-primary">
                <PieChart size={20} />
              </span>
              <h2 className="text-base font-medium text-content-primary">Distribución de archivos</h2>
            </div>
            <span className="text-xs text-content-tertiary font-medium">
              {totalFiles} archivo{totalFiles !== 1 ? 's' : ''} en total
            </span>
          </div>

          {data.breakdown.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-content-tertiary">
              No tienes archivos almacenados aún.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
              <div className="w-full sm:w-1/2 flex justify-center">
                <Chart
                  type="donut"
                  height={185}
                  series={chartSeries}
                  options={{
                    chart: { background: 'transparent' },
                    labels: chartLabels,
                    colors: chartColors,
                    theme: { mode: isDark ? 'dark' : 'light' },
                    stroke: { show: true, colors: [isDark ? '#1f2937' : '#ffffff'], width: 2 },
                    dataLabels: { enabled: false },
                    tooltip: {
                      y: { formatter: (val: number) => formatBytes(val) },
                      theme: isDark ? 'dark' : 'light',
                    },
                    legend: { show: false },
                    plotOptions: {
                      pie: {
                        donut: {
                          size: '72%',
                          labels: {
                            show: true,
                            name: { show: true, fontSize: '12px' },
                            value: { show: true, fontSize: '13px', formatter: (val: any) => formatBytes(Number(val)) },
                            total: {
                              show: true,
                              showAlways: false,
                              label: 'Usado',
                              fontSize: '12px',
                              formatter: () => formatBytes(data.used_bytes),
                            },
                          },
                        },
                      },
                    },
                  }}
                />
              </div>

              {/* Leyenda rápida */}
              <div className="w-full sm:w-1/2 space-y-2 max-h-44 overflow-y-auto pr-1">
                {data.breakdown.slice(0, 5).map((b) => {
                  const Icon = KIND_ICONS[b.kind] ?? File
                  const colors = KIND_COLORS[b.kind]
                  const catPercent = data.used_bytes > 0 ? ((b.bytes / data.used_bytes) * 100).toFixed(1) : '0'
                  return (
                    <div key={b.kind} className="flex items-center justify-between text-xs p-1.5 rounded bg-surface-hover/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', colors?.bg, colors?.text)}>
                          <Icon size={13} />
                        </span>
                        <span className="truncate text-content-primary font-medium">{KIND_META[b.kind]?.label}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-medium text-content-primary">{formatBytes(b.bytes)}</span>
                        <span className="text-content-tertiary ml-1">({catPercent}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bento Card 3: Estado de Capacidad & Tip */}
        <div className="rounded-drive border border-border bg-surface p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-content-secondary mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-subtle text-primary">
                <TrendingUp size={18} />
              </span>
              <span className="text-sm font-medium text-content-primary">Diagnóstico</span>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              {statusBadge.description}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-content-tertiary">Archivos totales</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-content-primary bg-surface-hover px-2 py-0.5 rounded-full">
              <Files size={12} />
              {totalFiles}
            </span>
          </div>
        </div>

        {/* Bento Card 4: Mayor Consumo */}
        <div className="rounded-drive border border-border bg-surface p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-content-secondary mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-subtle text-primary">
                <Upload size={18} />
              </span>
              <span className="text-sm font-medium text-content-primary">Mayor consumo</span>
            </div>

            {dominantCategory ? (
              <div className="space-y-1">
                {(() => {
                  const Icon = KIND_ICONS[dominantCategory.kind] ?? File
                  const colors = KIND_COLORS[dominantCategory.kind]
                  const domPercent = data.used_bytes > 0 ? ((dominantCategory.bytes / data.used_bytes) * 100).toFixed(0) : '0'
                  return (
                    <>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colors?.bg, colors?.text)}>
                          <Icon size={18} />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-content-primary">{KIND_META[dominantCategory.kind]?.label}</p>
                          <p className="text-xs text-content-tertiary">{dominantCategory.count} archivo(s)</p>
                        </div>
                      </div>
                      <p className="text-xl font-semibold text-content-primary mt-2">
                        {formatBytes(dominantCategory.bytes)}
                        <span className="text-xs font-normal text-content-tertiary ml-1.5">({domPercent}% del total)</span>
                      </p>
                    </>
                  )
                })()}
              </div>
            ) : (
              <p className="text-xs text-content-tertiary">Sin registros de archivos</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-content-tertiary">
            <span>Tipos de archivo en uso</span>
            <span className="font-medium text-content-primary">{data.breakdown.length} categorías</span>
          </div>
        </div>

      </div>

      {/* Sección Secundaria Bento: Grid de Categorías de Archivos */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-normal text-content-primary">Desglose por tipo de contenido</h2>
          <span className="text-xs text-content-tertiary">{data.breakdown.length} categorías registradas</span>
        </div>

        {data.breakdown.length === 0 ? (
          <div className="rounded-drive border border-border bg-surface p-12 text-center text-sm text-content-tertiary">
            <Files size={36} className="mx-auto mb-2 opacity-40 text-content-tertiary" />
            Aún no has subido archivos a tu almacenamiento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.breakdown.map((b) => {
              const Icon = KIND_ICONS[b.kind] ?? File
              const colors = KIND_COLORS[b.kind]
              const catPercentOfUsed = data.used_bytes > 0 ? ((b.bytes / data.used_bytes) * 100).toFixed(1) : '0'

              return (
                <div
                  key={b.kind}
                  className="group rounded-drive border border-border bg-surface p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-drive transition-transform duration-200 group-hover:scale-105', colors?.bg, colors?.text)}>
                        <Icon size={20} />
                      </span>
                      <div>
                        <h3 className="font-medium text-sm text-content-primary group-hover:text-primary transition-colors">
                          {KIND_META[b.kind]?.label ?? b.kind}
                        </h3>
                        <p className="text-xs text-content-tertiary">{b.count} archivo(s)</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold text-sm text-content-primary">{formatBytes(b.bytes)}</span>
                      <span className="text-content-tertiary font-medium">{catPercentOfUsed}%</span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', KIND_META[b.kind]?.bar ?? 'bg-primary')}
                        style={{ width: `${Math.min(100, Math.max(2, Number(catPercentOfUsed)))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
