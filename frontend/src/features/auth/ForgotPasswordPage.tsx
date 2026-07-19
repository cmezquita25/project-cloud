import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Button, Input, useLoader } from '@shared/ui'
import { ApiError } from '@shared/api'
import { authApi } from './services/authApi'

/** Solicitud de restablecimiento de contraseña. Respuesta siempre neutra. */
export function ForgotPasswordPage() {
  const loader = useLoader()
  const [login, setLogin] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await loader.wrap(authApi.requestPasswordReset(login.trim()), 'Enviando…')
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <MailCheck size={24} />
        </div>
        <h1 className="text-2xl font-semibold text-content-primary">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Si existe una cuenta asociada, te enviamos un enlace para restablecer tu contraseña.
          El enlace caduca en 60 minutos.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-content-primary">Restablecer contraseña</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Escribe tu correo o usuario y te enviaremos un enlace para crear una nueva contraseña.
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
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Enviar enlace
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft size={16} />
        Volver al inicio de sesión
      </Link>
    </div>
  )
}
