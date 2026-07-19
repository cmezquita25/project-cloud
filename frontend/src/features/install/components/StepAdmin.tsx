import { useEffect, useState, type FormEvent } from 'react'
import { User, Mail, Lock, IdCard, HardDrive } from 'lucide-react'
import { Button, Input } from '@shared/ui'
import { ApiError } from '@shared/api'
import { formatBytes } from '@shared/lib/formatBytes'
import { installApi } from '../services/installApi'
import { useAuth } from '@features/auth/AuthProvider'

interface StepAdminProps {
  onBack: () => void
  onDone: () => void
}

const GB = 1024 ** 3

/** Paso 3: crea la cuenta del primer administrador y bloquea el instalador. */
export function StepAdmin({ onBack, onDone }: StepAdminProps) {
  const [form, setForm] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
  })
  const [capacityGb, setCapacityGb] = useState('')
  const [detected, setDetected] = useState<{ total: number | null; free: number | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const { login } = useAuth()

  // Sugerencia de capacidad a partir de la detección del disco del servidor.
  useEffect(() => {
    const c = new AbortController()
    installApi
      .check(c.signal)
      .then((r) => {
        if (!r.disk) return
        setDetected({ total: r.disk.total_bytes, free: r.disk.free_bytes })
        if (r.disk.total_bytes && capacityGb === '') {
          setCapacityGb(String(Math.round(r.disk.total_bytes / GB)))
        }
      })
      .catch(() => {})
    return () => c.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const gb = parseFloat(capacityGb)
      const payload = {
        ...form,
        ...(Number.isFinite(gb) && gb > 0 ? { server_capacity_bytes: Math.round(gb * GB) } : {}),
      }
      await installApi.createAdmin(payload)
      // Iniciar sesión automáticamente
      await login({ login: form.username, password: form.password, remember: true })
      onDone()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setFieldErrors(err.fieldErrors)
      } else {
        setError('No se pudo crear la cuenta')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (k: string) => fieldErrors[k]?.[0]

  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-xl font-medium text-content-primary">Cuenta de administrador</h2>
      <p className="mt-1 text-sm text-content-secondary">
        Esta será tu cuenta principal con control total del sistema.
      </p>

      {error && (
        <div className="mt-4 rounded-drive border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <Input
          label="Nombre para mostrar"
          leftIcon={IdCard}
          value={form.display_name}
          onChange={set('display_name')}
          error={fieldError('display_name')}
          placeholder="Escribe un nombre para mostrar"
          autoComplete="off"
          required
        />
        <Input
          label="Nombre de usuario"
          leftIcon={User}
          value={form.username}
          onChange={set('username')}
          error={fieldError('username')}
          hint="Se usa en la URL de tus archivos: /storage/tu-usuario/…"
          placeholder="Escribe un nombre de usuario"
          autoComplete="off"
          required
        />
        <Input
          label="Correo electrónico"
          type="email"
          leftIcon={Mail}
          value={form.email}
          onChange={set('email')}
          error={fieldError('email')}
          placeholder="Escribe tu correo electrónico"
          autoComplete="off"
          required
        />
        <Input
          label="Contraseña"
          type="password"
          leftIcon={Lock}
          value={form.password}
          onChange={set('password')}
          error={fieldError('password')}
          hint="Mínimo 8 caracteres."
          placeholder="Escribe una contraseña"
          autoComplete="new-password"
          required
        />
        <Input
          label="Capacidad real del servidor (GB)"
          type="number"
          min={1}
          step={1}
          leftIcon={HardDrive}
          value={capacityGb}
          onChange={(e) => setCapacityGb(e.target.value)}
          hint={
            detected?.total
              ? `Detectado en el volumen: ${formatBytes(detected.total)} totales${
                  detected.free ? `, ${formatBytes(detected.free)} libres` : ''
                }. En hosting compartido puede reflejar el disco físico completo: ajústalo a tu cuota real (p. ej. 25).`
              : 'Introduce la capacidad asignada a tu cuenta de hosting (p. ej. 25). Es la base de las cuotas.'
          }
          placeholder="25"
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button type="submit" loading={submitting}>
          Crear e instalar
        </Button>
      </div>
    </form>
  )
}
