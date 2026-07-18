import { useCallback, useEffect, useState } from 'react'
import { Users, HardDrive, Shield, UserPlus, Activity as ActivityIcon, Pencil, Server, Images } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Dialog, Input, Spinner, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { formatBytes } from '@shared/lib/formatBytes'
import { useAuth } from '@features/auth/AuthProvider'
import { AssetsPermissionsDialog } from '@features/assets/components/AssetsPermissionsDialog'
import { adminApi } from './services/adminApi'
import { authApi } from '@features/auth/services/authApi'
import { UsersTable } from './components/UsersTable'
import { UserFormDialog } from './components/UserFormDialog'
import { PasswordResetDialog } from './components/PasswordResetDialog'
import { ActivityList } from './components/ActivityList'
import type { ActivityItem, AdminStats, AdminUser } from './types'

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

export function AdminPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const GB = 1024 ** 3
  const [capOpen, setCapOpen] = useState(false)
  const [capGb, setCapGb] = useState('')
  const [savingCap, setSavingCap] = useState(false)
  const [assetsPermOpen, setAssetsPermOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([adminApi.stats(), adminApi.users(), adminApi.activity(1, 40)])
      .then(([s, u, a]) => {
        setStats(s)
        setUsers(u)
        setActivity(a.items)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(load, [load])

  const toggleStatus = async (u: AdminUser) => {
    try {
      await adminApi.updateUser(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  const openCapacity = () => {
    setCapGb(stats && stats.server_capacity_bytes > 0 ? String(Math.round(stats.server_capacity_bytes / GB)) : '')
    setCapOpen(true)
  }

  const saveCapacity = async () => {
    const gb = parseFloat(capGb)
    if (!Number.isFinite(gb) || gb <= 0) {
      toast.error('Introduce una capacidad válida en GB')
      return
    }
    setSavingCap(true)
    try {
      const res = await adminApi.updateCapacity(Math.round(gb * GB))
      // Refresca el usuario en memoria para que sidebar/perfil reflejen el cambio.
      if (res.user) setUser(res.user)
      else await authApi.me().then(setUser)
      toast.success('Capacidad actualizada')
      setCapOpen(false)
      load()
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
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setDeleting(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'Resumen', icon: HardDrive },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'activity', label: 'Actividad', icon: ActivityIcon },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-normal text-content-primary">Administración</h1>
        {tab === 'users' && (
          <Button size="sm" leftIcon={UserPlus} onClick={() => { setEditUser(null); setFormOpen(true) }}>
            <span className="hidden sm:inline">Nuevo usuario</span>
          </Button>
        )}
      </div>

      {/* Pestañas */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-content-tertiary">
            <Spinner size={32} />
          </div>
        ) : tab === 'overview' && stats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="Usuarios" value={String(stats.users)} />
              <StatCard icon={Shield} label="Administradores" value={String(stats.admins)} />
              <StatCard icon={HardDrive} label="Espacio usado" value={formatBytes(stats.used)} />
              <StatCard icon={HardDrive} label="Asignado a usuarios" value={formatBytes(stats.allocated_users)} />
            </div>

            {/* Capacidad real del servidor (editable). */}
            <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                <Server size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-content-tertiary">Capacidad real del servidor</p>
                <p className="text-2xl font-medium text-content-primary">
                  {stats.server_capacity_bytes > 0 ? formatBytes(stats.server_capacity_bytes) : 'No definida'}
                </p>
                <p className="text-xs text-content-tertiary">
                  Asignado a usuarios: {formatBytes(stats.allocated_users)}
                  {stats.server_capacity_bytes > 0 && stats.allocated_users > stats.server_capacity_bytes && (
                    <span className="text-danger"> — supera la capacidad del servidor</span>
                  )}
                </p>
              </div>
              <Button size="sm" variant="secondary" leftIcon={Pencil} onClick={openCapacity}>
                Ajustar
              </Button>
            </div>

            {/* Acceso a la carpeta compartida "assets". */}
            <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                <Images size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-content-tertiary">Carpeta compartida (assets)</p>
                <p className="text-base font-medium text-content-primary">Acceso restringido</p>
                <p className="text-xs text-content-tertiary">
                  Solo tú y los usuarios que autorices pueden verla e interactuar con ella.
                </p>
              </div>
              <Button size="sm" variant="secondary" leftIcon={Images} onClick={() => setAssetsPermOpen(true)}>
                Gestionar acceso
              </Button>
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
          />
        ) : (
          <ActivityList items={activity} />
        )}
      </div>

      <UserFormDialog open={formOpen} user={editUser} onClose={() => setFormOpen(false)} onSaved={load} />
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
        <Input
          label="Capacidad (GB)"
          type="number"
          min={1}
          step={1}
          value={capGb}
          onChange={(e) => setCapGb(e.target.value)}
          placeholder="25"
          autoFocus
        />
      </Dialog>

      <AssetsPermissionsDialog open={assetsPermOpen} onClose={() => setAssetsPermOpen(false)} />
    </div>
  )
}
