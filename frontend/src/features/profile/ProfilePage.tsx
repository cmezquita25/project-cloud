import { useState, type FormEvent } from 'react'
import { Save, KeyRound, ShieldCheck, User as UserIcon } from 'lucide-react'
import { Avatar, Button, Input, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { formatBytes, usagePercent } from '@shared/lib/formatBytes'
import { useAuth } from '@features/auth/AuthProvider'
import { authApi } from '@features/auth/services/authApi'

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
        <Avatar name={user.display_name} size={64} />
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
          </div>
        </div>
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
