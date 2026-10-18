import { useState, type FormEvent } from 'react'
import { Button, Checkbox, Input, Select } from '@shared/ui'
import type { LinkAccess, LinkInput, LinkPolicy, ShareLink } from '../types'

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
  /** Políticas de la organización: limitan acceso y caducidad. */
  policy?: LinkPolicy
  /** La invitación de quien comparte bloquea la descarga. */
  downloadLocked?: boolean
  submitting?: boolean
  onSubmit: (input: LinkInput) => void
  onCancel?: () => void
}

/** Formulario de un enlace: acceso, caducidad, etiqueta, contraseña y descarga. */
export function LinkForm({ link, policy, downloadLocked = false, submitting = false, onSubmit, onCancel }: LinkFormProps) {
  const editing = Boolean(link)
  const maxSeconds = policy && policy.max_expiry_days > 0 ? policy.max_expiry_days * 86400 : null
  const allowNever = policy?.allow_never ?? true
  const allowAnyone = policy?.allow_anyone ?? true
  // Caducidades permitidas por la política (nunca más que el máximo).
  const allowedExpiry = EXPIRY_OPTIONS.filter((o) =>
    o.value === 'never' ? allowNever : o.value === 'custom' ? true : maxSeconds === null || Number(o.value) <= maxSeconds
  )
  const defaultExpiry = allowedExpiry.some((o) => o.value === '604800')
    ? '604800'
    : ([...allowedExpiry].reverse().find((o) => /^\d+$/.test(o.value))?.value ?? 'custom')

  const [access, setAccess] = useState<LinkAccess>(link?.access ?? (allowAnyone ? 'anyone' : 'members'))
  // Al editar se parte de «sin cambios» para no tocar la caducidad por accidente.
  const [expiry, setExpiry] = useState<string>(editing ? 'keep' : defaultExpiry)
  const [custom, setCustom] = useState(() =>
    toLocalInput(new Date(Date.now() + Math.min(7 * 86400, maxSeconds ?? Infinity) * 1000))
  )
  const [label, setLabel] = useState(link?.label ?? '')
  const [usePassword, setUsePassword] = useState(link?.has_password ?? false)
  const [password, setPassword] = useState('')
  const [allowDownload, setAllowDownload] = useState(downloadLocked ? false : (link?.allow_download ?? true))
  const [maxViews, setMaxViews] = useState(link?.max_views ? String(link.max_views) : '')
  const [error, setError] = useState<string | null>(null)

  const expiryOptions = editing
    ? [{ value: 'keep', label: link!.status === 'expired' ? 'Sin cambios (caducado)' : 'Sin cambios' }, ...allowedExpiry]
    : allowedExpiry
  const accessOptions = allowAnyone || link?.access === 'anyone' ? ACCESS_OPTIONS : ACCESS_OPTIONS.filter((o) => o.value === 'members')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: LinkInput = { access, label: label.trim() || null, allow_download: allowDownload }
    const views = maxViews.trim() === '' ? null : Number(maxViews)
    if (views !== null && (!Number.isInteger(views) || views < 1 || views > 1_000_000)) {
      setError('El límite de visitas debe ser un número entero mayor que 0 (vacío = sin límite).')
      return
    }
    input.max_views = views

    if (expiry === 'never') input.expires_in = null
    else if (expiry === 'custom') {
      const seconds = Math.round((new Date(custom).getTime() - Date.now()) / 1000)
      if (!Number.isFinite(seconds) || seconds < 60) {
        setError('La fecha de caducidad debe ser futura.')
        return
      }
      if (maxSeconds !== null && seconds > maxSeconds) {
        setError(`La organización permite como máximo ${policy!.max_expiry_days} días.`)
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
          <Select options={accessOptions} value={access} onChange={(v) => setAccess(v as LinkAccess)} />
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
          max={maxSeconds !== null ? toLocalInput(new Date(Date.now() + maxSeconds * 1000)) : undefined}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}
      <Input
        type="number"
        min={1}
        label="Límite de visitas (opcional)"
        placeholder="Sin límite"
        hint={link && link.max_views ? `Lleva ${link.view_count} de ${link.max_views}. Súbelo para que vuelva a abrir.` : 'Al alcanzarlo, el enlace deja de abrir para nuevos visitantes.'}
        value={maxViews}
        onChange={(e) => setMaxViews(e.target.value)}
      />
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
        <label className={downloadLocked ? 'inline-flex items-center gap-2 opacity-60' : 'inline-flex cursor-pointer items-center gap-2'} title={downloadLocked ? 'El propietario bloqueó la descarga para ti' : undefined}>
          <Checkbox checked={allowDownload} disabled={downloadLocked} onChange={(e) => setAllowDownload(e.target.checked)} />
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
      {(maxSeconds !== null || !allowAnyone) && (
        <p className="text-xs text-content-tertiary">
          Política de la organización:{' '}
          {[maxSeconds !== null && `caducidad máxima de ${policy!.max_expiry_days} días`, !allowAnyone && 'solo enlaces para miembros']
            .filter(Boolean)
            .join(' · ')}
          .
        </p>
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
