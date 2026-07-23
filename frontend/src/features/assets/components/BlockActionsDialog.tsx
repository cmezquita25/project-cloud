import { useState, useEffect } from 'react'
import { Dialog, Button, useToast } from '@shared/ui'
import { assetsApi } from '../services/assetsApi'
import { Lock } from 'lucide-react'
import type { DriveItem } from '@features/drive-explorer/types'

interface BlockActionsDialogProps {
  item: DriveItem | null
  onClose: () => void
  onSuccess: () => void
}

export function BlockActionsDialog({ item, onClose, onSuccess }: BlockActionsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState<Record<string, boolean>>({
    add: false,
    modify: false,
    delete: false,
    move: false,
  })
  const toast = useToast()

  useEffect(() => {
    if (item && item.blocked_actions) {
      setBlocked({
        add: item.blocked_actions.includes('add'),
        modify: item.blocked_actions.includes('modify'),
        delete: item.blocked_actions.includes('delete'),
        move: item.blocked_actions.includes('move'),
      })
    } else {
      setBlocked({ add: false, modify: false, delete: false, move: false })
    }
  }, [item])

  const handleSave = async () => {
    if (!item) return
    setLoading(true)
    const actionsToBlock = Object.keys(blocked).filter((k) => blocked[k]).join(',')
    try {
      await assetsApi.setBlockedActions(item.path, actionsToBlock)
      toast.success('Permisos actualizados correctamente')
      onSuccess()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar permisos')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (action: string) => {
    setBlocked((prev) => ({ ...prev, [action]: !prev[action] }))
  }

  return (
    <Dialog open={!!item} onClose={onClose} title={`Bloquear acciones: ${item?.name}`}>
      <div className="space-y-4 py-2">
        <p className="text-sm text-content-secondary">
          Selecciona qué acciones deseas bloquear para los usuarios. (Los administradores están exentos de estos bloqueos).
        </p>

        <div className="space-y-3 mt-4">
          {item?.type === 'folder' && (
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={blocked.add}
                onChange={() => handleToggle('add')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-content-primary">Subir/Crear (Añadir)</span>
            </label>
          )}

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={blocked.modify}
              onChange={() => handleToggle('modify')}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-content-primary">Modificar contenido</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={blocked.delete}
              onChange={() => handleToggle('delete')}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-content-primary">Eliminar</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={blocked.move}
              onChange={() => handleToggle('move')}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-content-primary">Mover / Renombrar</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button leftIcon={Lock} onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar bloqueos'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
