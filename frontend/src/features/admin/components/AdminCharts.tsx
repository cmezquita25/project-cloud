import { useState } from 'react'
import Chart from 'react-apexcharts'
import { api } from '@shared/api'
import { formatBytes } from '@shared/lib/formatBytes'
import { useTheme } from '@app/providers/ThemeProvider'
import { Spinner, Select } from '@shared/ui'
import { useQuery } from '@tanstack/react-query'
import { USER_COLORS } from './UserContributionChart'

interface AdminChartsProps {
  source: 'private' | 'workspace'
}

export function AdminCharts({ source }: AdminChartsProps) {
  const { resolved: theme } = useTheme()
  const isDark = theme === 'dark'
  const [period, setPeriod] = useState('30d')
  const [userId, setUserId] = useState('all')
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set())

  const toggleUser = (name: string) => {
    setHiddenUsers(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<any>('/admin/users')
  })

  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ['admin', 'charts', 'history', period, source, userId],
    queryFn: async () => {
      const uParam = userId !== 'all' ? `&user_id=${userId}` : ''
      if (source === 'workspace') {
        const res = await api.get<any>(`/admin/charts/workspace?period=${period}${uParam}`)
        return { history: res.history, distribution: res }
      }
      return api.get<any>(`/admin/charts/storage-history?period=${period}${uParam}`)
    }
  })

  const { data: distRes, isLoading: distLoading } = useQuery({
    queryKey: ['admin', 'charts', 'distribution', period, source, userId],
    queryFn: async () => {
      if (source === 'workspace') return null // Included in the history call for workspace
      const uParam = userId !== 'all' ? `&user_id=${userId}` : ''
      return api.get<any>(`/admin/charts/storage-distribution?period=${period}${uParam}`)
    }
  })

  if (historyLoading || distLoading) return (
    <div className="flex h-48 items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  const history = historyRes?.history || []
  const distribution = source === 'workspace' ? historyRes?.distribution : (distRes || null)

  const allUsersList = usersData?.items || []

  // 1. Mountain Chart (Historial de uso general)
  const historyOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
    colors: ['#3b82f6'],
    theme: { mode: isDark ? 'dark' : 'light' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    markers: { size: history.length === 1 ? 6 : 0 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
    },
    xaxis: {
      type: 'datetime',
      labels: { 
        style: { colors: isDark ? '#9ca3af' : '#6b7280' },
        datetimeFormatter: {
          year: 'yyyy',
          month: 'MMM \'yy',
          day: 'dd MMM',
          hour: 'HH:mm'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${Math.round(val)} MB`,
        style: { colors: isDark ? '#9ca3af' : '#6b7280' }
      }
    },
    grid: { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeDashArray: 4 },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      x: { format: 'dd MMM yyyy' },
      y: { formatter: (val: number) => `${val.toFixed(2)} MB` }
    }
  }
  const historySeries = [{ name: 'Registro Diario', data: history.map((item: any) => [new Date(item.date).getTime(), item.total_bytes / (1024 * 1024)]) }]

  // 2. Global Distribution (Storage-style stacked progress bar)
  const typeData = distribution?.by_type || []
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']
  const typeColors: Record<string, string> = {
    'image': COLORS[0] as string,
    'video': COLORS[1] as string,
    'audio': COLORS[2] as string,
    'document': COLORS[3] as string,
    'archive': COLORS[4] as string,
    'other': COLORS[5] as string,
  }

  const donutOptions = {
    chart: { type: 'donut', background: 'transparent' },
    labels: typeData.map((d: any) => d.type),
    colors: typeData.map((d: any, i: number) => typeColors[d.type] || COLORS[i % COLORS.length] || '#6b7280'),
    theme: { mode: isDark ? 'dark' : 'light' },
    stroke: { show: false },
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
    dataLabels: { enabled: false },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => formatBytes(val) }
    }
  }
  const donutSeries = typeData.map((d: any) => d.size_bytes || d.total_bytes)

  // 3. User Distribution (Area Stacked Chart)
  const userData = (distribution?.by_user || []).filter((u: any) => u.total_bytes > 0)
  const userHistory = distribution?.by_user_history || []
  
  const userNames = userData.map((u: any) => u.display_name || u.username)
  // We compute active series based on hidden state
  const activeSeries = userNames
    .filter((name: string) => !hiddenUsers.has(name))
    .map((name: string) => {
      return {
        name,
        data: userHistory.map((day: any) => [new Date(day.date).getTime(), (day[name] || 0) / (1024 * 1024)])
      }
    })

  const activeColors = userNames
    .map((name: string, i: number) => !hiddenUsers.has(name) ? USER_COLORS[i % USER_COLORS.length] : null)
    .filter((c: string | null) => c !== null)

  const userOptions = {
    chart: { type: 'area', stacked: false, toolbar: { show: false }, background: 'transparent' },
    colors: activeColors,
    theme: { mode: isDark ? 'dark' : 'light' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    markers: { size: userHistory.length === 1 ? 6 : 0 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.6, opacityTo: 0.1, stops: [0, 100] }
    },
    xaxis: {
      type: 'datetime',
      labels: { 
        style: { colors: isDark ? '#9ca3af' : '#6b7280' },
        datetimeFormatter: {
          year: 'yyyy',
          month: 'MMM \'yy',
          day: 'dd MMM',
          hour: 'HH:mm'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${Math.round(val)} MB`,
        style: { colors: isDark ? '#9ca3af' : '#6b7280' }
      }
    },
    grid: { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeDashArray: 4 },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      x: { format: 'dd MMM yyyy' },
      y: { formatter: (val: number) => `${val.toFixed(2)} MB` }
    },
    legend: { show: false } // We render a custom legend below
  }

  return (
    <div className="mt-6">
      {/* Filtros */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-content-primary">Estadísticas</h2>
        <div className="flex items-center gap-3">
          <Select 
            value={userId}
            onChange={(val) => setUserId(String(val))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48"
            options={[
              { value: 'all', label: 'Todos los usuarios' },
              ...allUsersList.map((u: any) => ({ value: String(u.id), label: u.display_name || u.username }))
            ]}
          />
          <Select 
            value={period}
            onChange={(val) => setPeriod(String(val))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            options={[
              { value: 'today', label: 'Hoy' },
              { value: '7d', label: 'Últimos 7 días' },
              { value: '30d', label: 'Este Mes' }
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Historial de Uso (Montaña) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Registro Diario (MB)</h3>
          <div className="h-[300px]">
            <Chart options={historyOptions as any} series={historySeries} type="area" height="100%" />
          </div>
        </div>

        {/* 2. Distribución global por tipo (Donut con leyenda storage-style) */}
        <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-between">
          <div>
            <h3 className="mb-4 text-base font-medium text-content-primary">Distribución por Tipo</h3>
            {typeData.length > 0 ? (
              <div className="flex flex-col gap-6">
                <div className="flex justify-center">
                  <Chart options={donutOptions as any} series={donutSeries} type="donut" width="100%" height={240} />
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                  {typeData.map((d: any, i: number) => {
                    const color = typeColors[d.type] || COLORS[i % COLORS.length] || '#6b7280'
                    return (
                      <div key={d.type} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium capitalize text-content-primary">{d.type}</p>
                          <p className="text-xs text-content-tertiary">{formatBytes(d.size_bytes || d.total_bytes)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-content-tertiary">
                No hay datos de archivos
              </div>
            )}
          </div>
        </div>

        {/* 3. Distribución por Usuario (Area Stacked Chart) */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Registro Diario por Usuario (MB)</h3>
          {userData.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="h-[350px]">
                <Chart options={userOptions as any} series={activeSeries} type="area" height="100%" />
              </div>
              
              {/* Custom Legend */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-4 gap-x-4 mt-2 border-t border-border pt-4 max-h-[200px] overflow-y-auto custom-scrollbar">
                {userData.map((u: any, i: number) => {
                  const name = u.display_name || u.username
                  const isHidden = hiddenUsers.has(name)
                  const color = USER_COLORS[i % USER_COLORS.length]
                  
                  return (
                    <div 
                      key={u.username || i} 
                      onClick={() => toggleUser(name)}
                      className={`flex items-center gap-3 text-sm cursor-pointer transition-all hover:bg-surface-hover p-2 rounded-lg -mx-2 ${isHidden ? 'opacity-40 grayscale' : 'opacity-100'}`}
                    >
                      <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-content-primary">{name}</p>
                        <p className="text-xs text-content-tertiary">{formatBytes(u.total_bytes)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-[350px] items-center justify-center text-sm text-content-tertiary">
              No hay usuarios o consumo registrado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

