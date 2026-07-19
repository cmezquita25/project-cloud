import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Input, Checkbox } from '@shared/ui'
import { ApiError } from '@shared/api'
import { useAuth } from './AuthProvider'

/** Pantalla de inicio de sesión (funcional). */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ login: '', password: '', remember: true })
  const [showPassword, setShowPassword] = useState(false)
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
      await login({ login: form.login.trim(), password: form.password, remember: form.remember })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-content-primary">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Ingresa tu correo y contraseña para acceder.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-drive border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <Input
          label="Correo electrónico o usuario"
          placeholder="tucorreo@ejemplo.com"
          value={form.login}
          onChange={set('login')}
          autoComplete="username"
          autoFocus
          required
        />
        <Input
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="rounded-full p-1 text-content-tertiary transition-colors hover:text-content-secondary focus-visible:outline-focus"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          placeholder="••••••••"
          value={form.password}
          onChange={set('password')}
          autoComplete="current-password"
          required
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-content-secondary">
          <Checkbox
            id="remember"
            checked={form.remember}
            onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
          />
          Recuérdame
        </label>
        <Button type="submit" fullWidth size="lg" loading={submitting} className="mt-1">
          Iniciar sesión
        </Button>
      </form>
    </div>
  )
}
