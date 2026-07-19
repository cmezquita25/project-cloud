import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import { Button, Input, Spinner, useLoader, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { authApi } from './services/authApi'

type TokenState = 'checking' | 'valid' | 'invalid'

/** Fija una nueva contraseña a partir del enlace único (token en la URL). */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const toast = useToast()
  const loader = useLoader()

  const [tokenState, setTokenState] = useState<TokenState>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenState('invalid')
      return
    }
    let alive = true
    authApi
      .validateResetToken(token)
      .then((r) => alive && setTokenState(r.valid ? 'valid' : 'invalid'))
      .catch(() => alive && setTokenState('invalid'))
    return () => {
      alive = false
    }
  }, [token])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      await loader.wrap(authApi.confirmPasswordReset(token, password), 'Guardando…')
      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  if (tokenState === 'checking') {
    return (
      <div className="flex h-40 items-center justify-center text-content-tertiary">
        <Spinner size={28} />
      </div>
    )
  }

  if (tokenState === 'invalid') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
          <XCircle size={24} />
        </div>
        <h1 className="text-2xl font-semibold text-content-primary">Enlace no válido</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Este enlace de restablecimiento no existe, ya se usó o ha caducado. Solicita uno nuevo.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          Solicitar un nuevo enlace
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-success-subtle text-success">
          <CheckCircle2 size={22} />
        </div>
        <h1 className="text-2xl font-semibold text-content-primary">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-content-secondary">Elige una contraseña segura para tu cuenta.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-drive border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <Input
          label="Nueva contraseña"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          rightElement={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="rounded-full p-1 text-content-tertiary transition-colors hover:text-content-secondary"
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          hint="Mínimo 8 caracteres"
          autoFocus
          required
        />
        <Input
          label="Confirmar contraseña"
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Guardar contraseña
        </Button>
      </form>
    </div>
  )
}
