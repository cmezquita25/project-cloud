import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, Button, Input } from '@shared/ui'
import { ApiError } from '@shared/api'
import { adminApi } from '../services/adminApi'
import type { AdminUser } from '../types'

interface PasswordResetDialogProps {
  open: boolean
  user: AdminUser | null
  onClose: () => void
  onDone: () => void
}

/** Restablece la contraseña de un usuario. */
export function PasswordResetDialog({ open, user, onClose, onDone }: PasswordResetDialogProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setError(null)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (password.length < 8) {
      setError('Mínimo 8 caracteres')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await adminApi.resetPassword(user.id, password)
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Restablecer contraseña"
      description={user ? `Nueva contraseña para ${user.display_name}.` : ''}
      size="sm"
    >
      <form onSubmit={submit}>
        <Input
          label="Nueva contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          autoComplete="new-password"
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Restablecer
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
