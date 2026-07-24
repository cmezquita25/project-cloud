import Chart from 'react-apexcharts'
import { api } from '@shared/api'
import { formatBytes } from '@shared/lib/formatBytes'
import { useTheme } from '@app/providers/ThemeProvider'
import { Spinner } from '@shared/ui'
import { useQuery } from '@tanstack/react-query'

// Usaremos la misma paleta de 15 colores
export const USER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  '#14b8a6', '#f43f5e', '#eab308', '#d946ef', '#0ea5e9'
]

interface UserContributionChartProps {
  period: string
}

export function UserContributionChart({ period }: UserContributionChartProps) {
  const { resolved: theme } = useTheme()
  const isDark = theme === 'dark'

  const { data: privateData, isLoading: loadingPrivate } = useQuery({
    queryKey: ['admin', 'charts', 'distribution', period, 'private'],
    queryFn: () => api.get<any>(`/admin/charts/storage-distribution?period=${period}`)
  })

  const { data: workspaceData, isLoading: loadingWorkspace } = useQuery({
    queryKey: ['admin', 'charts', 'history', period, 'workspace'],
    queryFn: () => api.get<any>(`/admin/charts/workspace?period=${period}`)
  })

  if (loadingPrivate || loadingWorkspace) return (
    <div className="flex h-48 items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  // Combinar los totales
  const combined: Record<string, { username: string, display_name: string, total_bytes: number }> = {}

  const processUserList = (list: any[]) => {
    for (const u of list || []) {
      const nameKey = u.display_name || u.username || 'system'
      if (!combined[nameKey]) {
        combined[nameKey] = { username: u.username, display_name: u.display_name, total_bytes: 0 }
      }
      combined[nameKey].total_bytes += (u.total_bytes || 0)
    }
  }

  processUserList(privateData?.by_user)
  processUserList(workspaceData?.by_user)

  const usersArray = Object.values(combined)
    .filter(u => u.total_bytes > 0)
    .sort((a, b) => b.total_bytes - a.total_bytes)

  if (usersArray.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="font-medium text-content-primary mb-2">Aportación Total por Usuario</h3>
        <p className="text-sm text-content-secondary mb-4">Uso combinado (Privado + Compartido)</p>
        <div className="flex-1 flex items-center justify-center text-sm text-content-tertiary">
          No hay consumo registrado
        </div>
      </div>
    )
  }

  const series = usersArray.map(u => u.total_bytes)
  const labels = usersArray.map(u => u.display_name || u.username)
  // Asignar colores repitiendo el patrón
  const colors = usersArray.map((_, i) => USER_COLORS[i % USER_COLORS.length] as string)

  const options = {
    chart: { type: 'donut', background: 'transparent' },
    labels,
    colors,
    theme: { mode: isDark ? 'dark' : 'light' },
    stroke: { show: true, colors: [isDark ? '#1f2937' : '#ffffff'], width: 2 },
    dataLabels: { enabled: false },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => formatBytes(val) }
    },
    legend: { show: false },
    plotOptions: { 
      pie: { 
        donut: { 
          size: '75%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px' },
            value: { show: true, fontSize: '14px', formatter: (val: any) => formatBytes(Number(val)) },
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              fontSize: '14px',
              formatter: function (w: any) {
                const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)
                return formatBytes(total)
              }
            }
          }
        } 
      } 
    },
  }

  return (
    <div className="flex flex-col">
      <h3 className="font-medium text-content-primary mb-2">Aportación Total por Usuario</h3>
      <p className="text-sm text-content-secondary mb-4">Uso combinado (Privado + Compartido)</p>
      
      <div className="flex justify-center mt-2">
        <Chart options={options as any} series={series} type="donut" height={220} />
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-6 border-t border-border pt-4 max-h-[200px] overflow-y-auto custom-scrollbar">
        {usersArray.map((u, i) => (
          <div key={u.username || i} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-content-primary">{u.display_name || u.username}</p>
              <p className="text-xs text-content-tertiary">{formatBytes(u.total_bytes)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
