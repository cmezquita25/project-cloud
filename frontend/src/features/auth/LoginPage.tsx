import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { User, Lock } from 'lucide-react'
import { Button, Input } from '@shared/ui'
import { ApiError } from '@shared/api'
import { getVersionFooter } from '@shared/config/version'
import { useAuth } from './AuthProvider'

/** Pantalla de inicio de sesión (funcional). */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ login: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login({ login: form.login.trim(), password: form.password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-medium text-content-primary">Inicia sesión</h1>
        <p className="mt-1 text-sm text-content-secondary">Accede a tu almacenamiento</p>
      </div>

      {error && (
        <div className="mb-4 rounded-drive border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Correo o nombre de usuario"
          leftIcon={User}
          placeholder="Escribe tu correo o usuario"
          value={form.login}
          onChange={set('login')}
          autoComplete="username"
          autoFocus
          required
        />
        <Input
          label="Contraseña"
          type="password"
          leftIcon={Lock}
          placeholder="Escribe tu contraseña"
          value={form.password}
          onChange={set('password')}
          autoComplete="current-password"
          required
        />
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Entrar
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-content-tertiary">{getVersionFooter()}</p>
    </div>
  )
}
