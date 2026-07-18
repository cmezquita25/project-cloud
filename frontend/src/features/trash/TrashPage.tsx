import { useCallback, useEffect, useState } from 'react'
import { Trash2, RotateCcw, Trash, MoreVertical } from 'lucide-react'
import { ApiError } from '@shared/api'
import { Button, EmptyState, Spinner, IconButton, Dialog, useToast, Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { cn } from '@shared/lib/cn'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatRelative } from '@shared/lib/formatDate'
import { trashApi } from './services/trashApi'
import type { DriveItem } from '@features/drive-explorer/types'

const key = (i: DriveItem) => `${i.type}-${i.id}`

export function TrashPage() {
  const toast = useToast()
  const [items, setItems] = useState<DriveItem[]>([])
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Diálogos de confirmación.
  const [confirmPurge, setConfirmPurge] = useState<DriveItem | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    trashApi
      .list(signal)
      .then((r) => {
        setItems([...r.folders, ...r.files])
        setRetentionDays(r.retention_days)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof ApiError ? e.message : 'No se pudo cargar la papelera')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const c = new AbortController()
    load(c.signal)
    return () => c.abort()
  }, [load])

  const restore = async (item: DriveItem) => {
    setBusy(key(item))
    try {
      await (item.type === 'folder' ? trashApi.restoreFolder(item.id) : trashApi.restoreFile(item.id))
      setItems((prev) => prev.filter((i) => key(i) !== key(item)))
      toast.success('Restaurado')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo restaurar')
    } finally {
      setBusy(null)
    }
  }

  const purge = async (item: DriveItem) => {
    setSubmitting(true)
    try {
      await (item.type === 'folder' ? trashApi.purgeFolder(item.id) : trashApi.purgeFile(item.id))
      setItems((prev) => prev.filter((i) => key(i) !== key(item)))
      toast.success('Eliminado definitivamente')
      setConfirmPurge(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar')
    } finally {
      setSubmitting(false)
    }
  }

  const emptyTrash = async () => {
    setSubmitting(true)
    try {
      await trashApi.empty()
      setItems([])
      toast.success('Papelera vaciada')
      setConfirmEmpty(false)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo vaciar la papelera')
    } finally {
      setSubmitting(false)
    }
  }

  const isEmpty = !loading && !error && items.length === 0

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-normal text-content-primary">Papelera</h1>
        {items.length > 0 && (
          <Button variant="secondary" size="sm" leftIcon={Trash} onClick={() => setConfirmEmpty(true)}>
            Vaciar papelera
          </Button>
        )}
      </div>

      {!isEmpty && (
        <p className="mb-4 rounded-drive bg-surface-container px-3 py-2 text-sm text-content-secondary">
          Los elementos de la papelera se eliminan definitivamente después de {retentionDays} días.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-content-tertiary">
            <Spinner size={32} />
          </div>
        ) : error ? (
          <div className="rounded-drive border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
            {error}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Trash2}
            title="La papelera está vacía"
            description="Los archivos y carpetas que elimines aparecerán aquí y podrás restaurarlos."
          />
        ) : (
          <div className="overflow-hidden rounded-drive border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
                  <th className="py-2 pl-3 font-medium">Nombre</th>
                  <th className="hidden py-2 font-medium sm:table-cell">Eliminado</th>
                  <th className="hidden py-2 font-medium md:table-cell">Tamaño</th>
                  <th className="w-24 py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <TrashRow
                    key={key(item)}
                    item={item}
                    busy={busy === key(item)}
                    onRestore={() => restore(item)}
                    onPurge={() => setConfirmPurge(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmar borrado definitivo */}
      <Dialog
        open={confirmPurge !== null}
        onClose={() => (submitting ? undefined : setConfirmPurge(null))}
        title="Eliminar definitivamente"
        description={
          confirmPurge
            ? `"${confirmPurge.name}" se eliminará para siempre. Esta acción no se puede deshacer.`
            : ''
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmPurge(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="danger" loading={submitting} onClick={() => confirmPurge && purge(confirmPurge)}>
              Eliminar para siempre
            </Button>
          </>
        }
      />

      {/* Confirmar vaciar papelera */}
      <Dialog
        open={confirmEmpty}
        onClose={() => (submitting ? undefined : setConfirmEmpty(false))}
        title="Vaciar la papelera"
        description="Todos los elementos de la papelera se eliminarán para siempre. Esta acción no se puede deshacer."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEmpty(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="danger" loading={submitting} onClick={emptyTrash}>
              Vaciar papelera
            </Button>
          </>
        }
      />
    </div>
  )
}

interface TrashRowProps {
  item: DriveItem
  busy: boolean
  onRestore: () => void
  onPurge: () => void
}

function TrashRow({ item, busy, onRestore, onPurge }: TrashRowProps) {
  const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')
  const menu = useDisclosure()

  const menuItems: MenuItem[] = [
    { id: 'restore', label: 'Restaurar', icon: RotateCcw, onSelect: onRestore },
    { id: 'purge', label: 'Eliminar definitivamente', icon: Trash2, onSelect: onPurge, danger: true, divider: true },
  ]

  return (
    <tr className="group border-b border-border/60 last:border-0">
      <td className="py-2 pl-3">
        <div className="flex items-center gap-3">
          <Icon size={20} className={cn('shrink-0', className)} />
          <span className="truncate text-content-primary">{item.name}</span>
        </div>
      </td>
      <td className="hidden py-2 text-content-secondary sm:table-cell">
        {item.deleted_at ? formatRelative(item.deleted_at) : '—'}
      </td>
      <td className="hidden py-2 text-content-secondary md:table-cell">
        {item.type === 'file' ? formatBytes(item.size_bytes) : '—'}
      </td>
      <td className="py-2 pr-2">
        <div className="flex items-center justify-end gap-1">
          {busy ? (
            <Spinner size={18} className="text-content-tertiary" />
          ) : (
            <IconButton icon={RotateCcw} label="Restaurar" size="sm" onClick={onRestore} />
          )}
          <div className="relative">
            <IconButton
              icon={MoreVertical}
              label="Más acciones"
              size="sm"
              active={menu.isOpen}
              onClick={menu.toggle}
            />
            <Menu open={menu.isOpen} onClose={menu.close} items={menuItems} title={item.name} align="right" />
          </div>
        </div>
      </td>
    </tr>
  )
}
