import { useState, useEffect, useRef } from 'react'
import { UserPlus, Trash2, Shield, Users, Info } from 'lucide-react'
import { Dialog, Button, Input, Select, Avatar, Spinner, useToast } from '@shared/ui'
import { api } from '@shared/api'
import type { Collaborator } from '../types'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  targetType: 'unit' | 'folder' | 'file'
  targetId: number | string | null
  targetName: string
  onShareSuccess?: () => void
}

interface UserSuggestion {
  id: number
  display_name: string
  email: string
  username: string
  avatar_url: string | null
}

export function ShareDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
  onShareSuccess,
}: ShareDialogProps) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [permissionLevel, setPermissionLevel] = useState<'read' | 'full'>('read')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Autocompletado de usuarios
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  const numTargetId = targetId !== null && targetId !== 'root' ? Number(targetId) : null

  const fetchCollaborators = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({ target_type: targetType })
      if (numTargetId) query.set('target_id', String(numTargetId))
      const res = await api.get<{ collaborators: Collaborator[] }>(`/shares?${query.toString()}`)
      setCollaborators(res.collaborators || [])
    } catch (err: any) {
      toast.error(err.message || 'No se pudieron cargar los colaboradores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setEmail('')
      setPermissionLevel('read')
      setSuggestions([])
      setShowSuggestions(false)
      fetchCollaborators()
    }
  }, [open, targetType, targetId])

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Búsqueda en tiempo real para autocompletado
  useEffect(() => {
    const term = email.trim()
    if (term.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const res = await api.get<{ users: UserSuggestion[] }>(`/users/search?q=${encodeURIComponent(term)}`)
        setSuggestions(res.users || [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggestions(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [email])

  const selectUser = (u: UserSuggestion) => {
    setEmail(u.email)
    setShowSuggestions(false)
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    try {
      await api.post('/shares', {
        target_type: targetType,
        target_id: numTargetId,
        email: email.trim(),
        permission_level: permissionLevel,
      })

      toast.success(`Acceso concedido a ${email.trim()}.`)
      setEmail('')
      setShowSuggestions(false)
      window.dispatchEvent(new CustomEvent('pc:shared-changed'))
      fetchCollaborators()
      if (onShareSuccess) onShareSuccess()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo otorgar el acceso.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdatePermission = async (shareId: number, newPerm: 'read' | 'full') => {
    try {
      await api.patch(`/shares/${shareId}`, { permission_level: newPerm })
      toast.success('Permiso actualizado.')
      window.dispatchEvent(new CustomEvent('pc:shared-changed'))
      fetchCollaborators()
      if (onShareSuccess) onShareSuccess()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo cambiar el permiso.')
    }
  }

  const handleRemoveShare = async (shareId: number, name: string) => {
    try {
      await api.delete(`/shares/${shareId}`)
      toast.success(`Acceso revocado para ${name}.`)
      window.dispatchEvent(new CustomEvent('pc:shared-changed'))
      fetchCollaborators()
      if (onShareSuccess) onShareSuccess()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo revocar el acceso.')
    }
  }

  const permissionOptions = [
    { value: 'read', label: 'Solo lectura' },
    { value: 'full', label: 'Control total' },
  ]

  return (
    <Dialog open={open} onClose={onClose} title={`Compartir acceso — ${targetName}`} size="2xl">
      <div className="space-y-6 pt-1">
        {/* Banner informativo de la organización */}
        <div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-subtle/40 p-3.5 text-xs text-content-secondary">
          <Info size={16} className="mt-0.5 shrink-0 text-info" />
          <span>
            <strong>Nota de la organización:</strong> La persona a invitar debe tener una cuenta registrada en la organización. Si no encuentra su correo en las sugerencias, solicite a un administrador su registro.
          </span>
        </div>

        {/* Formulario de invitación */}
        <form onSubmit={handleShare} className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-content-tertiary">
            Invitar a un miembro de la organización
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div ref={inputRef} className="relative flex-1 min-w-0">
              <Input
                type="email"
                placeholder="Escribe el nombre o correo del miembro..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => email.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                leftIcon={UserPlus}
                required
                autoComplete="off"
              />

              {/* Lista desplegable de sugerencias */}
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-elevation-3">
                  {loadingSuggestions ? (
                    <div className="flex items-center justify-center p-3 text-xs text-content-tertiary">
                      <Spinner size={16} className="mr-2" /> Buscando miembros...
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-3 text-xs text-center text-content-tertiary">
                      No se encontraron miembros activos con ese correo/nombre.
                    </div>
                  ) : (
                    suggestions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectUser(u)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-hover"
                      >
                        <Avatar src={u.avatar_url} name={u.display_name} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-content-primary">
                            {u.display_name}
                          </p>
                          <p className="truncate text-xs text-content-tertiary">{u.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="w-full sm:w-40 shrink-0">
              <Select
                options={permissionOptions}
                value={permissionLevel}
                onChange={(val) => setPermissionLevel(val as 'read' | 'full')}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!email.trim() || submitting}
              className="shrink-0 px-5 py-2.5"
            >
              Invitar
            </Button>
          </div>
        </form>

        <hr className="border-border opacity-60" />

        {/* Lista de personas con acceso */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
              <Users size={14} className="text-content-tertiary" />
              Personas con acceso ({collaborators.length})
            </h4>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size={28} />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {collaborators.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-surface-variant/40 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={c.avatar_url ?? undefined}
                      name={c.display_name}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content-primary truncate">
                        {c.display_name}
                      </p>
                      <p className="text-xs text-content-tertiary truncate">{c.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {c.role === 'owner' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-medium bg-primary-subtle text-primary border border-primary/20">
                        <Shield size={13} />
                        Propietario
                      </span>
                    ) : (
                      <>
                        <select
                          value={c.permission_level}
                          onChange={(e) =>
                            c.share_id &&
                            handleUpdatePermission(c.share_id, e.target.value as 'read' | 'full')
                          }
                          className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-content-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                        >
                          <option value="read">Solo lectura</option>
                          <option value="full">Control total</option>
                        </select>
                        {c.share_id && (
                          <button
                            type="button"
                            onClick={() => handleRemoveShare(c.share_id!, c.display_name)}
                            title="Quitar acceso"
                            className="p-1.5 text-content-tertiary hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose} className="px-5">
            Cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
