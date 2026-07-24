import { useRef, useState, type FormEvent } from 'react'
import { Save, KeyRound, ShieldCheck, User as UserIcon, Camera, Trash2 } from 'lucide-react'
import { Avatar, Button, Dialog, Input, Spinner, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { cn } from '@shared/lib/cn'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import { useAuth } from '@features/auth/AuthProvider'
import { authApi } from '@features/auth/services/authApi'
import { useQuota } from '@features/storage-quota/hooks/useQuota'
import { KIND_META } from '@features/storage-quota/kindMeta'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const toast = useToast()

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Estado del Modal de Contraseña
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const { data: quota } = useQuota()

  const avatarInput = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const onAvatarChange = async (e: FormEvent<HTMLInputElement>) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (avatarInput.current) avatarInput.current.value = ''
    if (!file) return
    setAvatarBusy(true)
    try {
      setUser(await authApi.uploadAvatar(file))
      toast.success('Foto de perfil actualizada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo subir la foto')
    } finally {
      setAvatarBusy(false)
    }
  }

  const removeAvatar = async () => {
    setAvatarBusy(true)
    try {
      setUser(await authApi.removeAvatar())
      toast.success('Foto de perfil eliminada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar la foto')
    } finally {
      setAvatarBusy(false)
    }
  }

  if (!user) return null

  const percent = usagePercent(user.used_bytes, user.quota_bytes)
  const profileDirty = displayName.trim() !== user.display_name || email.trim() !== user.email

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const updated = await authApi.updateProfile({
        display_name: displayName.trim(),
        email: email.trim(),
      })
      setUser(updated)
      toast.success('Perfil actualizado')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (next !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword({ current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setPasswordModalOpen(false)
      toast.success('Contraseña actualizada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Título de la página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-content-primary">Mi perfil</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Administra la información de tu cuenta, seguridad y almacenamiento.
          </p>
        </div>
      </div>

      {/* Grid Bento Principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Bento 1: Tarjeta de Identidad (Header - Col 12) */}
        <div className="lg:col-span-12 rounded-drive border border-border bg-surface p-6 shadow-sm transition-all hover:border-border-strong">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <Avatar name={user.display_name} src={user.avatar_url} size={72} />
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  disabled={avatarBusy}
                  aria-label="Cambiar foto de perfil"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-primary-on shadow-elevation-1 transition-colors hover:bg-primary-hover disabled:opacity-60"
                  title="Cambiar foto"
                >
                  {avatarBusy ? <Spinner size={14} /> : <Camera size={15} />}
                </button>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onAvatarChange}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="truncate text-xl font-medium text-content-primary">{user.display_name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-pill bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary">
                    {user.role === 'admin' ? <ShieldCheck size={13} /> : <UserIcon size={13} />}
                    {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                  </span>
                </div>
                <p className="truncate text-sm text-content-secondary mt-0.5">@{user.username} • {user.email}</p>

                {user.avatar_url && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    disabled={avatarBusy}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:underline disabled:opacity-60 transition-colors"
                  >
                    <Trash2 size={13} /> Eliminar foto de perfil
                  </button>
                )}
              </div>
            </div>

            {/* Acción de Seguridad (Abrir Modal de Contraseña) */}
            <div className="shrink-0 self-start sm:self-center">
              <Button
                variant="secondary"
                leftIcon={KeyRound}
                onClick={() => setPasswordModalOpen(true)}
              >
                Cambiar contraseña
              </Button>
            </div>
          </div>
        </div>

        {/* Bento 2: Almacenamiento (Col 7 en Escritorio) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-drive border border-border bg-surface p-6 shadow-sm transition-all hover:border-border-strong">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 text-content-primary">
                <span className="material-symbols-rounded text-[22px] text-primary">cloud</span>
                <h3 className="font-medium text-base">Almacenamiento</h3>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-pill bg-surface-container text-content-secondary">
                {percent.toFixed(1)}% usado
              </span>
            </div>

            <p className="text-2xl font-medium text-content-primary mb-1">
              {formatBytes(user.used_bytes)}
            </p>
            <p className="text-xs text-content-tertiary mb-4">
              de {formatBytes(user.quota_bytes)} totales asignados a tu cuenta
            </p>

            {/* Barra segmentada por tipo */}
            <div className="flex h-3.5 w-full overflow-hidden rounded-pill bg-surface-hover">
              {(quota?.breakdown ?? []).map((b) => {
                const w = quota && quota.quota_bytes > 0 ? (b.bytes / quota.quota_bytes) * 100 : 0
                return (
                  <div
                    key={b.kind}
                    className={cn('h-full transition-all', KIND_META[b.kind].bar)}
                    style={{ width: `${w}%` }}
                    title={`${KIND_META[b.kind].label}: ${formatBytes(b.bytes)}`}
                  />
                )
              })}
            </div>
          </div>

          {/* Desglose por tipo */}
          <div className="mt-6 border-t border-border/60 pt-4">
            {quota && quota.breakdown.length > 0 ? (
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {quota.breakdown.map((b) => (
                  <li key={b.kind} className="flex items-center gap-2.5 text-xs">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', KIND_META[b.kind].dot)} />
                    <span className="flex-1 truncate text-content-primary font-medium">{KIND_META[b.kind].label}</span>
                    <span className="text-content-tertiary">({b.count})</span>
                    <span className="font-medium text-content-secondary">{formatBytes(b.bytes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-content-tertiary">Aún no has subido archivos a tu espacio.</p>
            )}
          </div>
        </div>

        {/* Bento 3: Datos de la Cuenta (Col 5 en Escritorio) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-drive border border-border bg-surface p-6 shadow-sm transition-all hover:border-border-strong">
          <form onSubmit={saveProfile} className="flex h-full flex-col justify-between space-y-4">
            <div>
              <h3 className="mb-4 text-base font-medium text-content-primary">Datos personales</h3>
              <div className="space-y-4">
                <Input
                  label="Nombre visible"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={120}
                  required
                />
                <Input
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  label="Usuario"
                  value={user.username}
                  disabled
                  hint="El nombre de usuario es identificador único y no se puede cambiar."
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 flex justify-end">
              <Button type="submit" leftIcon={Save} loading={savingProfile} disabled={!profileDirty}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Global: Cambiar Contraseña */}
      <Dialog
        open={passwordModalOpen}
        onClose={() => (savingPassword ? undefined : setPasswordModalOpen(false))}
        title="Cambiar contraseña"
        description="Introduce tu contraseña actual y define una nueva clave segura."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setPasswordModalOpen(false)}
              disabled={savingPassword}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="change-password-form"
              loading={savingPassword}
              disabled={!current || !next || !confirm}
            >
              Actualizar contraseña
            </Button>
          </>
        }
      >
        <form id="change-password-form" onSubmit={savePassword} className="space-y-4 pt-2">
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            hint="Mínimo 8 caracteres."
            required
          />
          <Input
            label="Repite la nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </form>
      </Dialog>
    </div>
  )
}
