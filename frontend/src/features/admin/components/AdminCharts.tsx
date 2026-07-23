import { useState } from 'react'
import Chart from 'react-apexcharts'
import { api } from '@shared/api'
import { formatBytes } from '@shared/lib/formatBytes'
import { useTheme } from '@app/providers/ThemeProvider'
import { Spinner, Select } from '@shared/ui'
import { useQuery } from '@tanstack/react-query'

interface AdminChartsProps {
  source: 'private' | 'workspace'
}

export function AdminCharts({ source }: AdminChartsProps) {
  const { resolved: theme } = useTheme()
  const isDark = theme === 'dark'
  const [period, setPeriod] = useState('30d')

  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ['admin', 'charts', 'history', period, source],
    queryFn: async () => {
      if (source === 'workspace') {
        const res = await api.get<any>(`/admin/charts/workspace?period=${period}`)
        return { history: res.history, distribution: res }
      }
      return api.get<any>(`/admin/charts/storage-history?period=${period}`)
    }
  })

  const { data: distRes, isLoading: distLoading } = useQuery({
    queryKey: ['admin', 'charts', 'distribution', period, source],
    queryFn: async () => {
      if (source === 'workspace') return null // Included in the history call for workspace
      return api.get<any>(`/admin/charts/storage-distribution?period=${period}`)
    }
  })

  if (historyLoading || distLoading) return (
    <div className="flex h-48 items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  const history = historyRes?.history || []
  const distribution = source === 'workspace' ? historyRes?.distribution : (distRes || null)

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
      categories: history.map((item: any) => new Date(item.date).toLocaleDateString()),
      labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } },
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
      y: { formatter: (val: number) => `${val.toFixed(2)} MB` }
    }
  }
  const historySeries = [{ name: 'Almacenamiento', data: history.map((item: any) => item.total_bytes / (1024 * 1024)) }]

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
    plotOptions: { pie: { donut: { size: '75%' } } },
    dataLabels: { enabled: false },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => formatBytes(val) }
    }
  }
  const donutSeries = typeData.map((d: any) => d.size_bytes || d.total_bytes)

  // 3. User Distribution (Mountain Chart)
  const userData = distribution?.by_user || []
  const userOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
    colors: ['#3b82f6'],
    theme: { mode: isDark ? 'dark' : 'light' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    markers: { size: userData.length === 1 ? 6 : 0 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
    },
    xaxis: {
      categories: userData.map((u: any) => u.display_name || u.username),
      labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } },
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
      y: { formatter: (val: number) => `${val.toFixed(2)} MB` }
    }
  }
  const userSeries = [{ name: 'Consumo', data: userData.map((u: any) => (u.used_bytes || u.total_bytes) / (1024 * 1024)) }]

  return (
    <div className="mt-6">
      {/* Filtros */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-content-primary">Estadísticas</h2>
        <Select 
          value={period}
          onChange={(val) => setPeriod(String(val))}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          options={[
            { value: 'today', label: 'Hoy' },
            { value: '7d', label: 'Últimos 7 días' },
            { value: '30d', label: 'Mes' }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Historial de Uso (Montaña) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Historial de Uso</h3>
          <div className="h-[300px]">
            <Chart options={historyOptions as any} series={historySeries} type="area" height="100%" />
          </div>
        </div>

        {/* 2. Distribución global por tipo (Donut con leyenda storage-style) */}
        <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-between">
          <div>
            <h3 className="mb-4 text-base font-medium text-content-primary">Distribución Global</h3>
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

        {/* 3. Distribución por Usuario (Mountain) */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Distribución por Usuario</h3>
          {userData.length > 0 ? (
            <div className="h-[350px]">
              <Chart options={userOptions as any} series={userSeries} type="area" height="100%" />
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
