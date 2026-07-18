import { useEffect, useState, type FormEvent } from 'react'
import { HelpCircle } from 'lucide-react'
import { Dialog, Button, Input, Tooltip } from '@shared/ui'
import { ApiError } from '@shared/api'
import { adminApi } from '../services/adminApi'
import type { AdminUser } from '../types'

interface UserFormDialogProps {
  open: boolean
  user: AdminUser | null // null = crear
  onClose: () => void
  onSaved: () => void
}

const MB = 1024 ** 2
const GB = 1024 ** 3
type Unit = 'MB' | 'GB'

const toBytes = (value: string, unit: Unit) =>
  Math.max(0, Math.round(parseFloat(value || '0') * (unit === 'GB' ? GB : MB)))

/** Elige la unidad más legible para un valor en bytes. */
const fromBytes = (bytes: number): { value: string; unit: Unit } => {
  if (bytes === 0) return { value: '0', unit: 'GB' }
  if (bytes < GB) return { value: String(Math.round(bytes / MB)), unit: 'MB' }
  const gb = bytes / GB
  return { value: gb % 1 === 0 ? String(gb) : gb.toFixed(1), unit: 'GB' }
}

const EMPTY = {
  username: '',
  email: '',
  display_name: '',
  password: '',
  role: 'user' as 'admin' | 'user',
  quotaVal: '5',
  quotaUnit: 'GB' as Unit,
  maxVal: '2',
  maxUnit: 'GB' as Unit,
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
    if (user) {
      const q = fromBytes(user.quota_bytes)
      const m = fromBytes(user.max_upload_bytes)
      setForm({
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        password: '',
        role: user.role,
        quotaVal: q.value,
        quotaUnit: q.unit,
        maxVal: m.value,
        maxUnit: m.unit,
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, user])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const quota_bytes = toBytes(form.quotaVal, form.quotaUnit)
      const max_upload_bytes = toBytes(form.maxVal, form.maxUnit)
      if (isEdit) {
        await adminApi.updateUser(user.id, {
          email: form.email,
          display_name: form.display_name,
          role: form.role,
          quota_bytes,
          max_upload_bytes,
        })
      } else {
        await adminApi.createUser({
          username: form.username.trim().toLowerCase(),
          email: form.email.trim(),
          display_name: form.display_name.trim(),
          password: form.password,
          role: form.role,
          quota_bytes,
          max_upload_bytes,
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuotaField
            label="Cuota de almacenamiento"
            help="Espacio TOTAL que este usuario puede ocupar con todos sus archivos. Al alcanzarlo, no podrá subir más hasta liberar espacio."
            value={form.quotaVal}
            unit={form.quotaUnit}
            onValue={set('quotaVal')}
            onUnit={(u) => setForm((f) => ({ ...f, quotaUnit: u }))}
          />
          <QuotaField
            label="Máximo por archivo"
            help="Tamaño MÁXIMO permitido para un solo archivo al subirlo. Archivos que superen este límite serán rechazados."
            value={form.maxVal}
            unit={form.maxUnit}
            onValue={set('maxVal')}
            onUnit={(u) => setForm((f) => ({ ...f, maxUnit: u }))}
          />
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

/** Campo numérico con selector de unidad (MB/GB) y tooltip explicativo. */
function QuotaField({
  label,
  help,
  value,
  unit,
  onValue,
  onUnit,
}: {
  label: string
  help: string
  value: string
  unit: Unit
  onValue: (e: { target: { value: string } }) => void
  onUnit: (unit: Unit) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-sm font-medium text-content-secondary">{label}</label>
        <Tooltip content={<span className="block max-w-[220px] whitespace-normal">{help}</span>} side="top">
          <HelpCircle size={15} className="cursor-help text-content-tertiary" />
        </Tooltip>
      </div>
      <div className="flex gap-2">
        <Input type="number" min="0" step="0.5" value={value} onChange={onValue} className="flex-1" />
        <select
          value={unit}
          onChange={(e) => onUnit(e.target.value as Unit)}
          aria-label={`Unidad de ${label}`}
          className="h-11 shrink-0 rounded-drive border border-border-strong bg-surface px-3 text-content-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="MB">MB</option>
          <option value="GB">GB</option>
        </select>
      </div>
    </div>
  )
}
