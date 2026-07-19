import { useRef, useState, type FormEvent } from 'react'
import { Save, KeyRound, ShieldCheck, User as UserIcon, Cloud, Camera, Trash2 } from 'lucide-react'
import { Avatar, Button, Input, Spinner, useToast } from '@shared/ui'
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
      toast.success('Contraseña actualizada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-normal text-content-primary">Mi perfil</h1>

      {/* Cabecera de identidad */}
      <div className="mb-4 flex items-center gap-4 rounded-drive border border-border bg-surface p-6">
        <div className="relative shrink-0">
          <Avatar name={user.display_name} src={user.avatar_url} size={64} />
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            disabled={avatarBusy}
            aria-label="Cambiar foto de perfil"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-primary text-primary-on shadow-elevation-1 transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {avatarBusy ? <Spinner size={13} /> : <Camera size={14} />}
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
          <p className="truncate text-lg font-medium text-content-primary">{user.display_name}</p>
          <p className="truncate text-sm text-content-secondary">@{user.username}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
            <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5">
              {user.role === 'admin' ? <ShieldCheck size={13} /> : <UserIcon size={13} />}
              {user.role === 'admin' ? 'Administrador' : 'Usuario'}
            </span>
            <span>
              {formatBytes(user.used_bytes)} de {formatBytes(user.quota_bytes)} usados ({percent.toFixed(0)}%)
            </span>
            {user.avatar_url && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarBusy}
                className="inline-flex items-center gap-1 text-danger hover:underline disabled:opacity-60"
              >
                <Trash2 size={12} /> Quitar foto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Almacenamiento: uso total + desglose por tipo (igual que Almacenamiento). */}
      <div className="mb-4 rounded-drive border border-border bg-surface p-6">
        <div className="mb-2 flex items-center gap-2 text-content-secondary">
          <Cloud size={20} />
          <span className="font-medium">Almacenamiento</span>
        </div>
        <p className="text-sm text-content-tertiary">
          {formatBytes(user.used_bytes)} de {formatBytes(user.quota_bytes)} usados ({percent.toFixed(0)}%)
        </p>

        {/* Barra segmentada por tipo */}
        <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-pill bg-surface-hover">
          {(quota?.breakdown ?? []).map((b) => {
            const w = quota && quota.quota_bytes > 0 ? (b.bytes / quota.quota_bytes) * 100 : 0
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

        {/* Desglose por tipo */}
        {quota && quota.breakdown.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {quota.breakdown.map((b) => (
              <li key={b.kind} className="flex items-center gap-2.5 text-sm">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', KIND_META[b.kind].dot)} />
                <span className="flex-1 truncate text-content-primary">{KIND_META[b.kind].label}</span>
                <span className="text-xs text-content-tertiary">{b.count}</span>
                <span className="w-20 text-right font-medium text-content-primary">{formatBytes(b.bytes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-content-tertiary">Aún no has subido archivos.</p>
        )}
      </div>

      {/* Datos del perfil */}
      <form onSubmit={saveProfile} className="mb-4 rounded-drive border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-medium text-content-primary">Datos de la cuenta</h2>
        <div className="flex flex-col gap-4">
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
          <Input label="Usuario" value={user.username} disabled hint="El nombre de usuario no se puede cambiar." />
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" leftIcon={Save} loading={savingProfile} disabled={!profileDirty}>
            Guardar cambios
          </Button>
        </div>
      </form>

      {/* Cambio de contraseña */}
      <form onSubmit={savePassword} className="rounded-drive border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-medium text-content-primary">Cambiar contraseña</h2>
        <div className="flex flex-col gap-4">
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
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
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            leftIcon={KeyRound}
            loading={savingPassword}
            disabled={!current || !next || !confirm}
          >
            Actualizar contraseña
          </Button>
        </div>
      </form>
    </div>
  )
}
