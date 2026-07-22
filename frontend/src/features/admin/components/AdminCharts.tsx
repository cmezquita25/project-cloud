import { useState } from 'react'
import Chart from 'react-apexcharts'
import { api } from '@shared/api'
import { formatBytes } from '@shared/lib/formatBytes'
import { useTheme } from '@app/providers/ThemeProvider'
import { Spinner } from '@shared/ui'
import { useQuery } from '@tanstack/react-query'

export function AdminCharts() {
  const { resolved: theme } = useTheme()
  const isDark = theme === 'dark'
  const [period, setPeriod] = useState('30d')

  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ['admin', 'charts', 'history', period],
    queryFn: () => api.get<any>(`/admin/charts/storage-history?period=${period}`)
  })

  const { data: distRes, isLoading: distLoading } = useQuery({
    queryKey: ['admin', 'charts', 'distribution', period],
    queryFn: () => api.get<any>(`/admin/charts/storage-distribution?period=${period}`)
  })

  if (historyLoading || distLoading) return (
    <div className="flex h-48 items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  const history = historyRes?.history || []
  const distribution = distRes || null

  // 1. Mountain Chart (Historial de uso general)
  const historyOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
    colors: ['var(--color-primary)'],
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

  // 2. Donut Chart (Distribución por tipo)
  const typeData = distribution?.by_type || []
  const donutOptions = {
    chart: { type: 'donut', background: 'transparent' },
    labels: typeData.map((d: any) => d.type),
    theme: { mode: isDark ? 'dark' : 'light' },
    stroke: { show: false },
    plotOptions: { pie: { donut: { size: '75%' } } },
    dataLabels: { enabled: false },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => formatBytes(val) }
    }
  }
  const donutSeries = typeData.map((d: any) => d.total_bytes)

  // 3. Bar Chart (Distribución por usuario)
  const userData = distribution?.by_user || []
  const barOptions = {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
    colors: ['var(--color-primary)'],
    theme: { mode: isDark ? 'dark' : 'light' },
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: true,
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: userData.map((u: any) => u.display_name || u.username),
      labels: { 
        formatter: (val: number) => `${Math.round(val)} MB`,
        style: { colors: isDark ? '#9ca3af' : '#6b7280' } 
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } }
    },
    grid: { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeDashArray: 4 },
    tooltip: { 
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => `${val.toFixed(2)} MB` }
    }
  }
  const barSeries = [{ name: 'Consumo', data: userData.map((u: any) => u.total_bytes / (1024 * 1024)) }]

  return (
    <div className="mt-6">
      {/* Filtros */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-content-primary">Estadísticas</h2>
        <select 
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Mes</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Historial de Uso (Montaña) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Historial de Uso</h3>
          <div className="h-[300px]">
            <Chart options={historyOptions as any} series={historySeries} type="area" height="100%" />
          </div>
        </div>

        {/* 2. Distribución global por tipo (Donut) */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Distribución Global</h3>
          {typeData.length > 0 ? (
            <div className="h-[300px] w-full flex items-center justify-center">
              <Chart options={{...donutOptions as any, chart: { ...donutOptions.chart, width: '100%' }}} series={donutSeries} type="donut" width="100%" height="100%" />
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-content-tertiary">
              No hay datos de archivos
            </div>
          )}
        </div>

        {/* 3. Distribución por Usuario (Bar) */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-base font-medium text-content-primary">Distribución por Usuario</h3>
          {userData.length > 0 ? (
            <div className="h-[350px]">
              <Chart options={barOptions as any} series={barSeries} type="bar" height="100%" />
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
