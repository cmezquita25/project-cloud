import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Users, HardDrive, UserPlus, Pencil, Server } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Dialog, Input, Spinner, useToast, Select } from '@shared/ui'
import { formatBytes } from '@shared/lib/formatBytes'
import { useAuth } from '@features/auth/AuthProvider'
import { adminApi } from './services/adminApi'
import { authApi } from '@features/auth/services/authApi'
import { UsersTable } from './components/UsersTable'
import { UserFormDialog } from './components/UserFormDialog'
import { PasswordResetDialog } from './components/PasswordResetDialog'
import { ActivityList } from './components/ActivityList'
import { ServerLimits } from './components/ServerLimits'
import { AdminCharts } from './components/AdminCharts'
import { UserContributionChart } from './components/UserContributionChart'
import Chart from 'react-apexcharts'
import { useTheme } from '@app/providers/ThemeProvider'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'
import type { AdminUser } from './types'

type Tab = 'overview' | 'users' | 'activity'

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <Icon size={22} />
      </span>
      <div>
        <p className="text-2xl font-medium text-content-primary">{value}</p>
        <p className="text-sm text-content-tertiary">{label}</p>
      </div>
    </div>
  )
}

/** Deriva la sección activa desde la URL (cada una es su propia ruta). */
function tabFromPath(pathname: string): Tab {
  if (pathname.startsWith('/admin/users')) return 'users'
  if (pathname.startsWith('/admin/activity')) return 'activity'
  return 'overview'
}

const TAB_TITLE: Record<Tab, string> = {
  overview: 'Panel de administración',
  users: 'Usuarios',
  activity: 'Registros de auditoría',
}

export function AdminPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const tab = tabFromPath(location.pathname)

  const queryClient = useQueryClient()

  const [userPage, setUserPage] = useState(1)
  const [userLimit, setUserLimit] = useState(10)

  const [activityPage, setActivityPage] = useState(1)
  const [activityLimit, setActivityLimit] = useState(30)

  const { access } = useAssetsAccess()
  const { resolved: theme } = useTheme()
  const isDark = theme === 'dark'

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.stats()
  })

  const { data: serverInfo, isLoading: serverInfoLoading } = useQuery({
    queryKey: ['admin', 'serverInfo'],
    queryFn: () => adminApi.serverInfo()
  })

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', userPage, userLimit],
    queryFn: () => adminApi.users(userPage, userLimit)
  })
  const users = usersData?.items ?? []
  const userTotal = usersData?.total ?? 0

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['admin', 'activity', activityPage, activityLimit],
    queryFn: () => adminApi.activity(activityPage, activityLimit)
  })
  const activity = activityData?.items ?? []
  const activityTotal = activityData?.total ?? 0

  const loading = statsLoading || serverInfoLoading || usersLoading || activityLoading

  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const MB = 1024 ** 2
  const GB = 1024 ** 3
  const [capOpen, setCapOpen] = useState(false)
  const [capVal, setCapVal] = useState('')
  const [capUnit, setCapUnit] = useState<'MB' | 'GB'>('GB')
  const [assetsCapVal, setAssetsCapVal] = useState('')
  const [assetsCapUnit, setAssetsCapUnit] = useState<'MB' | 'GB'>('GB')
  const [savingCap, setSavingCap] = useState(false)

  const invalidateAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const toggleStatus = async (u: AdminUser) => {
    try {
      await adminApi.updateUser(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })
      invalidateAdmin()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  const openCapacity = () => {
    const bytes = stats?.server_capacity_bytes ?? 0
    if (bytes > 0 && bytes < GB) {
      setCapVal(String(Math.round(bytes / MB)))
      setCapUnit('MB')
    } else {
      setCapVal(bytes > 0 ? String(Math.round(bytes / GB)) : '')
      setCapUnit('GB')
    }

    const assetsBytes = stats?.assets_quota_bytes ?? 0
    if (assetsBytes > 0 && assetsBytes < GB) {
      setAssetsCapVal(String(Math.round(assetsBytes / MB)))
      setAssetsCapUnit('MB')
    } else {
      setAssetsCapVal(assetsBytes > 0 ? String(Math.round(assetsBytes / GB)) : '')
      setAssetsCapUnit('GB')
    }

    setCapOpen(true)
  }

  const saveCapacity = async () => {
    const val = parseFloat(capVal)
    if (!Number.isFinite(val) || val <= 0) {
      toast.error(`Introduce una capacidad válida en ${capUnit}`)
      return
    }

    const assetsVal = parseFloat(assetsCapVal)
    if (!Number.isFinite(assetsVal) || assetsVal <= 0) {
      toast.error(`Introduce una cuota válida para la Unidad Compartida`)
      return
    }

    const bytes = Math.round(val * (capUnit === 'GB' ? GB : MB))
    const assetsBytes = Math.round(assetsVal * (assetsCapUnit === 'GB' ? GB : MB))

    setSavingCap(true)
    try {
      const res = await adminApi.updateCapacity(bytes, assetsBytes)
      if (res.user) setUser(res.user)
      else await authApi.me().then(setUser)
      toast.success('Capacidad actualizada')
      setCapOpen(false)
      invalidateAdmin()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingCap(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteUser) return
    setDeleting(true)
    try {
      await adminApi.deleteUser(deleteUser.id)
      toast.success('Usuario eliminado')
      setDeleteUser(null)
      invalidateAdmin()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-normal text-content-primary">{TAB_TITLE[tab]}</h1>
          {tab === 'users' && (
            <p className="mt-1 text-sm text-content-secondary">
              Gestiona los accesos, roles y el almacenamiento de los miembros de tu organización.
            </p>
          )}
        </div>
        {tab === 'users' && (
          <Button size="sm" leftIcon={UserPlus} onClick={() => { setEditUser(null); setFormOpen(true) }}>
            <span className="hidden sm:inline">Nuevo usuario</span>
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-content-tertiary">
            <Spinner size={32} />
          </div>
        ) : tab === 'overview' && stats ? (
          <div className="space-y-6 pb-12">

            {/* Bento Grid: Top row - Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard icon={Users} label="Usuarios" value={String(stats.users)} />
              <StatCard icon={HardDrive} label="Asignado a usuarios" value={formatBytes(stats.allocated_users)} />
              <StatCard icon={HardDrive} label="Espacio total usado" value={formatBytes(stats.used + stats.assets_used_bytes)} />
              <StatCard icon={HardDrive} label="Usado Unidades" value={formatBytes(stats.used)} />
              <StatCard icon={HardDrive} label="Usado Compartida" value={formatBytes(stats.assets_used_bytes)} />
            </div>

            {/* Bento Grid: Main sections */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Left Column - Charts (2/3 width on xl) */}
              <div className="xl:col-span-2 space-y-6 flex flex-col">
                <section className="flex-1 rounded-drive border border-border bg-surface p-5 shadow-sm">
                  <h2 className="text-xl font-medium text-content-primary mb-2">Mi Unidad</h2>
                  <p className="text-sm text-content-secondary mb-6">Uso y distribución del almacenamiento privado de los usuarios.</p>
                  <AdminCharts source="private" />
                </section>

                {access?.active && (
                  <section className="flex-1 rounded-drive border border-border bg-surface p-5 shadow-sm">
                    <h2 className="text-xl font-medium text-content-primary mb-2">Espacio de Trabajo</h2>
                    <p className="text-sm text-content-secondary mb-6">Uso y distribución de la carpeta compartida.</p>
                    <AdminCharts source="workspace" />
                  </section>
                )}
              </div>

              {/* Right Column - Server Limits & Info (1/3 width on xl) */}
              <div className="xl:col-span-1 space-y-6 flex flex-col">
                <div className="flex flex-col justify-between gap-4 rounded-drive border border-border bg-surface p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                      <Server size={22} />
                    </span>
                    <h3 className="font-medium text-content-primary">Límites del Servidor</h3>
                  </div>
                  <div>
                    <div className="grid grid-cols-2 gap-4 mt-2 mb-2">
                      <div>
                        <p className="text-sm font-medium text-content-secondary">Capacidad Asignada</p>
                        <p className="text-2xl font-medium text-content-primary">
                          {stats.server_capacity_bytes > 0 ? formatBytes(stats.server_capacity_bytes) : 'No definida'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-content-secondary">Espacio Disponible</p>
                        <p className="text-2xl font-medium text-success">
                          {stats.server_capacity_bytes > 0 ? formatBytes(Math.max(0, stats.server_capacity_bytes - (stats.used + stats.assets_used_bytes))) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-content-secondary">Total Espacio Usado:</p>
                      <p className="text-sm font-medium text-content-primary">{formatBytes(stats.used + stats.assets_used_bytes)}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm text-content-secondary">Usado Unidades:</p>
                      <p className="text-sm font-medium text-content-primary">{formatBytes(stats.used)}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm text-content-secondary">Usado Compartida:</p>
                      <p className="text-sm font-medium text-content-primary">{formatBytes(stats.assets_used_bytes)}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <p className="text-sm text-content-secondary font-medium">Espacio libre sin asignar</p>
                      <p className="text-sm font-medium text-success">
                        {stats.server_capacity_bytes > 0 ? formatBytes(Math.max(0, stats.server_capacity_bytes - stats.allocated_users - stats.assets_quota_bytes)) : 'N/A'}
                      </p>
                    </div>

                    {stats.server_capacity_bytes > 0 && (stats.allocated_users + stats.assets_quota_bytes) > stats.server_capacity_bytes && (
                      <span className="mt-2 block text-sm font-medium text-danger">Las cuotas superan la capacidad real del servidor</span>
                    )}
                  </div>

                  {stats.server_capacity_bytes > 0 && (
                    <div className="mt-2 flex justify-center border-t border-border pt-4">
                      <Chart
                        type="donut"
                        height={180}
                        series={[
                          stats.allocated_users,
                          stats.assets_quota_bytes,
                          Math.max(0, stats.server_capacity_bytes - stats.allocated_users - stats.assets_quota_bytes)
                        ]}
                        options={{
                          chart: { background: 'transparent' },
                          labels: ['Asignado Unidades', 'Asignado Compartida', 'Libre'],
                          colors: ['#3b82f6', '#8b5cf6', isDark ? '#374151' : '#e5e7eb'],
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
                                    formatter: function () {
                                      return formatBytes(stats.server_capacity_bytes)
                                    }
                                  }
                                }
                              } 
                            } 
                          },
                        }}
                      />
                    </div>
                  )}

                  <Button size="sm" variant="secondary" leftIcon={Pencil} onClick={openCapacity} className="w-full mt-2">
                    Ajustar capacidades
                  </Button>
                </div>

                {serverInfo && (
                  <div className="rounded-drive border border-border bg-surface p-5 shadow-sm">
                    <ServerLimits serverInfo={serverInfo} />
                  </div>
                )}

                <div className="rounded-drive border border-border bg-surface p-5 shadow-sm">
                  <UserContributionChart period="30d" />
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'users' ? (
          <UsersTable
            users={users}
            currentUserId={user?.id ?? 0}
            onEdit={(u) => { setEditUser(u); setFormOpen(true) }}
            onResetPassword={setPwdUser}
            onToggleStatus={toggleStatus}
            onDelete={setDeleteUser}
            page={userPage}
            limit={userLimit}
            total={userTotal}
            onPageChange={setUserPage}
            onLimitChange={setUserLimit}
          />
        ) : (
          <ActivityList
            items={activity}
            page={activityPage}
            limit={activityLimit}
            total={activityTotal}
            onPageChange={setActivityPage}
            onLimitChange={setActivityLimit}
          />
        )}
      </div>

      <UserFormDialog open={formOpen} user={editUser} onClose={() => setFormOpen(false)} onSaved={invalidateAdmin} />
      <PasswordResetDialog open={pwdUser !== null} user={pwdUser} onClose={() => setPwdUser(null)} onDone={() => toast.success('Contraseña restablecida')} />
      <Dialog
        open={deleteUser !== null}
        onClose={() => setDeleteUser(null)}
        title="Eliminar usuario"
        description={deleteUser ? `Se eliminará "${deleteUser.display_name}" y todos sus archivos. Esta acción no se puede deshacer.` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteUser(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>Eliminar</Button>
          </>
        }
      />

      <Dialog
        open={capOpen}
        onClose={() => (savingCap ? undefined : setCapOpen(false))}
        title="Capacidad real del servidor"
        description="Ajusta la capacidad total asignada a tu hosting. Es la base para repartir cuotas entre usuarios."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCapOpen(false)} disabled={savingCap}>Cancelar</Button>
            <Button onClick={saveCapacity} loading={savingCap}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm font-medium text-content-primary">Capacidad Real del Servidor</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Total en Disco"
                type="number"
                min={1}
                step={capUnit === 'GB' ? 1 : 100}
                value={capVal}
                onChange={(e) => setCapVal(e.target.value)}
                placeholder={capUnit === 'GB' ? '25' : '500'}
                autoFocus
              />
            </div>
            <Select
              value={capUnit}
              onChange={(val) => setCapUnit(String(val) as 'MB' | 'GB')}
              className="h-11 rounded-drive border border-border-strong bg-surface px-3 text-sm text-content-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
              options={[
                { value: 'MB', label: 'MB' },
                { value: 'GB', label: 'GB' }
              ]}
            />
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-sm font-medium text-content-primary mb-3">Asignación para Unidad Compartida</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Cuota asignada"
                  type="number"
                  min={1}
                  step={assetsCapUnit === 'GB' ? 1 : 100}
                  value={assetsCapVal}
                  onChange={(e) => setAssetsCapVal(e.target.value)}
                  placeholder={assetsCapUnit === 'GB' ? '5' : '500'}
                />
              </div>
              <Select
                value={assetsCapUnit}
                onChange={(val) => setAssetsCapUnit(String(val) as 'MB' | 'GB')}
                className="h-11 rounded-drive border border-border-strong bg-surface px-3 text-sm text-content-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
                options={[
                  { value: 'MB', label: 'MB' },
                  { value: 'GB', label: 'GB' }
                ]}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
