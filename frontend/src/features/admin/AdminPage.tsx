import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Users, HardDrive, Shield, UserPlus, Pencil, Server } from 'lucide-react'
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
      // Menos de 1 GB: es más natural mostrarlo en MB.
      setCapVal(String(Math.round(bytes / MB)))
      setCapUnit('MB')
    } else {
      setCapVal(bytes > 0 ? String(Math.round(bytes / GB)) : '')
      setCapUnit('GB')
    }
    setCapOpen(true)
  }

  const saveCapacity = async () => {
    const val = parseFloat(capVal)
    if (!Number.isFinite(val) || val <= 0) {
      toast.error(`Introduce una capacidad válida en ${capUnit}`)
      return
    }
    const bytes = Math.round(val * (capUnit === 'GB' ? GB : MB))
    setSavingCap(true)
    try {
      const res = await adminApi.updateCapacity(bytes)
      // Refresca el usuario en memoria para que sidebar/perfil reflejen el cambio.
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
          <div className="space-y-12 pb-12">
            
            <section>
              <h2 className="text-xl font-medium text-content-primary mb-2">Mi Unidad</h2>
              <p className="text-sm text-content-secondary mb-6">Uso y distribución del almacenamiento privado de los usuarios.</p>
              <AdminCharts source="private" />
            </section>

            {access?.active && (
              <section>
                <h2 className="text-xl font-medium text-content-primary mb-2">Espacio de Trabajo</h2>
                <p className="text-sm text-content-secondary mb-6">Uso y distribución de la carpeta compartida.</p>
                <AdminCharts source="workspace" />
              </section>
            )}

            <section>
              <h2 className="text-xl font-medium text-content-primary mb-6">Visión General</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                  <StatCard icon={Users} label="Usuarios" value={String(stats.users)} />
                  <StatCard icon={Shield} label="Administradores" value={String(stats.admins)} />
                  <StatCard icon={HardDrive} label="Espacio usado" value={formatBytes(stats.used)} />
                  <StatCard icon={HardDrive} label="Asignado a usuarios" value={formatBytes(stats.allocated_users)} />
                </div>

                <div className="lg:col-span-4">
                  <div className="flex h-full flex-col justify-between gap-4 rounded-drive border border-border bg-surface p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                        <Server size={22} />
                      </span>
                      <h3 className="font-medium text-content-primary">Capacidad del servidor</h3>
                    </div>
                    <div>
                      <p className="text-3xl font-medium text-content-primary">
                        {stats.server_capacity_bytes > 0 ? formatBytes(stats.server_capacity_bytes) : 'No definida'}
                      </p>
                      <p className="mt-1 text-sm text-content-tertiary">
                        Asignado: {formatBytes(stats.allocated_users)}
                        {stats.server_capacity_bytes > 0 && stats.allocated_users > stats.server_capacity_bytes && (
                          <span className="mt-1 block text-danger">Supera la capacidad del servidor</span>
                        )}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" leftIcon={Pencil} onClick={openCapacity} className="w-full">
                      Ajustar capacidad
                    </Button>
                  </div>
                </div>
              </div>

              {serverInfo && (
                <div className="mt-6">
                  <ServerLimits serverInfo={serverInfo} />
                </div>
              )}
            </section>
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
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Capacidad"
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
      </Dialog>
    </div>
  )
}
