import { useEffect, useState, type FormEvent } from 'react'
import { HelpCircle, MailCheck, KeyRound } from 'lucide-react'
import { Dialog, Button, Input, Tooltip, Checkbox, useToast, Select } from '@shared/ui'
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
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [generate, setGenerate] = useState(true)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setFieldErrors({})
    setGenerate(true)
    setCreatedPassword(null)
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
        onSaved()
        onClose()
      } else {
        const res = await adminApi.createUser({
          username: form.username.trim().toLowerCase(),
          email: form.email.trim(),
          display_name: form.display_name.trim(),
          generate,
          password: generate ? undefined : form.password,
          role: form.role,
          quota_bytes,
          max_upload_bytes,
        })
        onSaved()
        // Si se generó contraseña pero no hubo correo, se muestra para compartir.
        if (res.generated_password) {
          setCreatedPassword(res.generated_password)
        } else {
          toast.success(
            res.email_sent ? 'Usuario creado. Se envió el correo de bienvenida.' : 'Usuario creado.'
          )
          onClose()
        }
      }
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

  // Panel de resultado: contraseña generada que no se pudo enviar por correo.
  if (createdPassword) {
    return (
      <Dialog open={open} onClose={onClose} title="Usuario creado" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-drive border border-warning/30 bg-warning/10 p-3 text-sm text-content-secondary">
            <MailCheck size={20} className="mt-0.5 shrink-0 text-warning" />
            <p>
              No se pudo enviar el correo de bienvenida (revisa la configuración del SMTP).
              Comparte esta contraseña temporal con el usuario de forma segura:
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-drive border border-border bg-surface-container p-3">
            <KeyRound size={18} className="shrink-0 text-content-tertiary" />
            <code className="flex-1 select-all font-mono text-base text-content-primary">{createdPassword}</code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(createdPassword).then(
                  () => toast.success('Contraseña copiada'),
                  () => toast.error('No se pudo copiar')
                )
              }}
            >
              Copiar
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Entendido</Button>
          </div>
        </div>
      </Dialog>
    )
  }

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
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-content-secondary">
              <Checkbox
                id="gen-pwd"
                checked={generate}
                onChange={(e) => setGenerate(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Generar contraseña automática y enviarla por correo
                <span className="block text-xs text-content-tertiary">
                  El usuario recibe una contraseña temporal y un enlace para fijar la suya.
                </span>
              </span>
            </label>
            {!generate && (
              <Input
                label="Contraseña"
                type="password"
                value={form.password}
                onChange={set('password')}
                error={fe('password')}
                hint="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
              />
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-content-secondary">Rol</label>
          <Select
            value={form.role}
            onChange={(val) => setForm((f) => ({ ...f, role: val as 'admin' | 'user' }))}
            className="h-11 w-full rounded-drive border border-border-strong bg-surface px-3 text-content-primary focus:outline-none focus:ring-2 focus:ring-focus"
            options={[
              { value: 'user', label: 'Usuario' },
              { value: 'admin', label: 'Administrador' }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuotaField
            label="Almacenamiento"
            help="Espacio TOTAL que este usuario puede ocupar con todos sus archivos. Al alcanzarlo, no podrá subir más hasta liberar espacio."
            value={form.quotaVal}
            unit={form.quotaUnit}
            onValue={set('quotaVal')}
            onUnit={(u) => setForm((f) => ({ ...f, quotaUnit: u }))}
          />
          <QuotaField
            label="Subida máxima"
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
        <Select
          value={unit}
          onChange={(val) => onUnit(String(val) as Unit)}
          className="h-11 shrink-0 rounded-drive border border-border-strong bg-surface px-3 text-content-primary focus:outline-none focus:ring-2 focus:ring-focus"
          options={[
            { value: 'MB', label: 'MB' },
            { value: 'GB', label: 'GB' }
          ]}
        />
      </div>
    </div>
  )
}
