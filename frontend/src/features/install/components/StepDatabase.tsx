import { useState, type FormEvent } from 'react'
import { Database, Server, KeyRound, User } from 'lucide-react'
import { Button, Input } from '@shared/ui'
import { ApiError } from '@shared/api'
import { installApi } from '../services/installApi'

interface StepDatabaseProps {
  onBack: () => void
  onNext: () => void
}

/** Paso 2: credenciales de base de datos (prueba conexión, crea tablas, guarda config). */
export function StepDatabase({ onBack, onNext }: StepDatabaseProps) {
  // Campos vacíos y genéricos (sin sugerir valores). host/puerto son estándar.
  const [form, setForm] = useState({
    host: 'localhost',
    port: '3306',
    name: '',
    user: '',
    pass: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await installApi.saveDatabase({
        host: form.host.trim(),
        port: Number(form.port) || 3306,
        name: form.name.trim(),
        user: form.user.trim(),
        pass: form.pass,
      })
      onNext()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con la base de datos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-xl font-medium text-content-primary">Base de datos</h2>
      <p className="mt-1 text-sm text-content-secondary">
        Introduce las credenciales de tu base de datos MySQL/MariaDB. Crearemos las
        tablas automáticamente.
      </p>

      {error && (
        <div className="mt-4 rounded-drive border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Host"
              leftIcon={Server}
              value={form.host}
              onChange={set('host')}
              placeholder="localhost"
              required
            />
          </div>
          <Input label="Puerto" value={form.port} onChange={set('port')} inputMode="numeric" />
        </div>
        <Input
          label="Nombre de la base de datos"
          leftIcon={Database}
          value={form.name}
          onChange={set('name')}
          placeholder="Escribe el nombre de tu base de datos"
          autoComplete="off"
          required
        />
        <Input
          label="Usuario"
          leftIcon={User}
          value={form.user}
          onChange={set('user')}
          placeholder="Escribe el usuario de la base de datos"
          autoComplete="off"
          required
        />
        <Input
          label="Contraseña"
          type="password"
          leftIcon={KeyRound}
          value={form.pass}
          onChange={set('pass')}
          placeholder="Escribe la contraseña de la base de datos"
          autoComplete="off"
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button type="submit" loading={submitting}>
          Probar y continuar
        </Button>
      </div>
    </form>
  )
}
