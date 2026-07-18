import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Dialog, Button, Checkbox, Spinner, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { assetsApi, type AssetPermissionUser } from '../services/assetsApi'

interface Props {
  open: boolean
  onClose: () => void
}

/** Gestiona qué usuarios pueden ver/interactuar con la unidad compartida "assets". */
export function AssetsPermissionsDialog({ open, onClose }: Props) {
  const toast = useToast()
  const [users, setUsers] = useState<AssetPermissionUser[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    assetsApi
      .permissions()
      .then((r) => {
        setUsers(r.users)
        // Preselecciona los no-admin ya permitidos (los admin siempre tienen acceso).
        setSelected(new Set(r.users.filter((u) => u.role !== 'admin' && u.allowed).map((u) => u.id)))
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los permisos'))
      .finally(() => setLoading(false))
  }, [open, toast])

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      await assetsApi.setPermissions([...selected])
      toast.success('Permisos actualizados')
      onClose()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudieron guardar los permisos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => (saving ? undefined : onClose())}
      title="Acceso a la carpeta compartida"
      description="Elige qué usuarios pueden ver e interactuar con «assets». Los administradores siempre tienen acceso."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={loading}>
            Guardar
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex h-32 items-center justify-center text-content-tertiary">
          <Spinner size={28} />
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {users.map((u) => {
            const isAdmin = u.role === 'admin'
            return (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <Checkbox
                  checked={isAdmin || selected.has(u.id)}
                  disabled={isAdmin}
                  onChange={() => toggle(u.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content-primary">{u.display_name}</p>
                  <p className="truncate text-xs text-content-tertiary">@{u.username}</p>
                </div>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-xs text-content-tertiary">
                    <ShieldCheck size={12} /> Admin
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
