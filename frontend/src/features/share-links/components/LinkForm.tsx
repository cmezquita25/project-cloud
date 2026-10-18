import { useState, type FormEvent } from 'react'
import { Button, Checkbox, Input, Select } from '@shared/ui'
import type { LinkAccess, LinkInput, ShareLink } from '../types'

/** Opciones de caducidad (segundos). */
const EXPIRY_OPTIONS = [
  { value: '3600', label: '1 hora' },
  { value: '86400', label: '24 horas' },
  { value: '604800', label: '7 días' },
  { value: '2592000', label: '30 días' },
  { value: 'custom', label: 'Fecha personalizada' },
  { value: 'never', label: 'Sin caducidad' },
]

const ACCESS_OPTIONS = [
  { value: 'anyone', label: 'Cualquiera con el enlace' },
  { value: 'members', label: 'Solo miembros de la organización' },
]

/** Valor para <input type="datetime-local"> (hora local). */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface LinkFormProps {
  /** Si se pasa, el formulario edita ese enlace (si no, crea uno nuevo). */
  link?: ShareLink
  submitting?: boolean
  onSubmit: (input: LinkInput) => void
  onCancel?: () => void
}

/** Formulario de un enlace: acceso, caducidad, etiqueta, contraseña y descarga. */
export function LinkForm({ link, submitting = false, onSubmit, onCancel }: LinkFormProps) {
  const editing = Boolean(link)
  const [access, setAccess] = useState<LinkAccess>(link?.access ?? 'anyone')
  // Al editar se parte de «sin cambios» para no tocar la caducidad por accidente.
  const [expiry, setExpiry] = useState<string>(editing ? 'keep' : '604800')
  const [custom, setCustom] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86400_000)))
  const [label, setLabel] = useState(link?.label ?? '')
  const [usePassword, setUsePassword] = useState(link?.has_password ?? false)
  const [password, setPassword] = useState('')
  const [allowDownload, setAllowDownload] = useState(link?.allow_download ?? true)
  const [error, setError] = useState<string | null>(null)

  const expiryOptions = editing
    ? [{ value: 'keep', label: link!.status === 'expired' ? 'Sin cambios (caducado)' : 'Sin cambios' }, ...EXPIRY_OPTIONS]
    : EXPIRY_OPTIONS

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: LinkInput = { access, label: label.trim() || null, allow_download: allowDownload }

    if (expiry === 'never') input.expires_in = null
    else if (expiry === 'custom') {
      const seconds = Math.round((new Date(custom).getTime() - Date.now()) / 1000)
      if (!Number.isFinite(seconds) || seconds < 60) {
        setError('La fecha de caducidad debe ser futura.')
        return
      }
      input.expires_in = seconds
    } else if (expiry !== 'keep') input.expires_in = Number(expiry)

    if (!usePassword) {
      if (link?.has_password) input.password = null
    } else if (password !== '') {
      if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres.')
        return
      }
      input.password = password
    } else if (!link?.has_password) {
      setError('Escribe la contraseña o desmarca la opción.')
      return
    }
    onSubmit(input)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-content-secondary">Acceso</span>
          <Select options={ACCESS_OPTIONS} value={access} onChange={(v) => setAccess(v as LinkAccess)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-content-secondary">Caduca</span>
          <Select options={expiryOptions} value={expiry} onChange={(v) => setExpiry(String(v))} />
        </label>
      </div>
      {expiry === 'custom' && (
        <Input
          type="datetime-local"
          label="Fecha y hora de caducidad"
          value={custom}
          min={toLocalInput(new Date(Date.now() + 60_000))}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}
      <Input
        label="Etiqueta (opcional)"
        placeholder='Ej.: "QR stand expo", "Cliente X"'
        value={label}
        maxLength={120}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-content-primary">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <Checkbox checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
          Proteger con contraseña
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <Checkbox checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
          Permitir descarga
        </label>
      </div>
      {usePassword && (
        <Input
          type="password"
          label="Contraseña del enlace"
          placeholder={link?.has_password ? '•••••• (sin cambios)' : 'Mínimo 4 caracteres'}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="sm" loading={submitting}>
          {editing ? 'Guardar cambios' : 'Crear enlace'}
        </Button>
      </div>
    </form>
  )
}
