import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, Button, Input } from '@shared/ui'
import { ApiError } from '@shared/api'
import { adminApi } from '../services/adminApi'
import type { AdminUser } from '../types'

interface UserFormDialogProps {
  open: boolean
  user: AdminUser | null // null = crear
  onClose: () => void
  onSaved: () => void
}

const GB = 1024 ** 3
const toGB = (bytes: number) => (bytes / GB).toFixed(bytes % GB === 0 ? 0 : 1)
const fromGB = (gb: string) => Math.round(parseFloat(gb || '0') * GB)

const EMPTY = {
  username: '',
  email: '',
  display_name: '',
  password: '',
  role: 'user' as 'admin' | 'user',
  quotaGB: '5',
  maxUploadGB: '2',
}

/** Alta y edición de usuarios. */
export function UserFormDialog({ open, user, onClose, onSaved }: UserFormDialogProps) {
  const isEdit = user !== null
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setFieldErrors({})
    setForm(
      user
        ? {
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            password: '',
            role: user.role,
            quotaGB: toGB(user.quota_bytes),
            maxUploadGB: toGB(user.max_upload_bytes),
          }
        : EMPTY
    )
  }, [open, user])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (isEdit) {
        await adminApi.updateUser(user.id, {
          email: form.email,
          display_name: form.display_name,
          role: form.role,
          quota_bytes: fromGB(form.quotaGB),
          max_upload_bytes: fromGB(form.maxUploadGB),
        })
      } else {
        await adminApi.createUser({
          username: form.username.trim().toLowerCase(),
          email: form.email.trim(),
          display_name: form.display_name.trim(),
          password: form.password,
          role: form.role,
          quota_bytes: fromGB(form.quotaGB),
          max_upload_bytes: fromGB(form.maxUploadGB),
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setFieldErrors(err.fieldErrors)
      } else {
        setError('No se pudo guardar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fe = (k: string) => fieldErrors[k]?.[0]

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? 'Editar usuario' : 'Nuevo usuario'} size="md">
      {error && (
        <div className="mb-4 rounded-drive border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nombre para mostrar" value={form.display_name} onChange={set('display_name')} error={fe('display_name')} required />
        {!isEdit && (
          <Input label="Nombre de usuario" value={form.username} onChange={set('username')} error={fe('username')} hint="Se usa en /storage/usuario/… (no se puede cambiar luego)" autoComplete="off" required />
        )}
        <Input label="Correo electrónico" type="email" value={form.email} onChange={set('email')} error={fe('email')} autoComplete="off" required />
        {!isEdit && (
          <Input label="Contraseña" type="password" value={form.password} onChange={set('password')} error={fe('password')} hint="Mínimo 8 caracteres" autoComplete="new-password" required />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-content-secondary">Rol</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
            className="h-11 w-full rounded-drive border border-border-strong bg-surface px-3 text-content-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Cuota (GB)" type="number" min="0" step="0.5" value={form.quotaGB} onChange={set('quotaGB')} />
          <Input label="Máx. por archivo (GB)" type="number" min="0" step="0.5" value={form.maxUploadGB} onChange={set('maxUploadGB')} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Guardar' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
