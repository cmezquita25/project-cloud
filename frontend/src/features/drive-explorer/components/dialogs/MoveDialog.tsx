import { useEffect, useState } from 'react'
import { Folder, ChevronRight, ChevronLeft, HardDrive } from 'lucide-react'
import { Dialog, Button, Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { driveApi } from '../../services/driveApi'
import type { Breadcrumb, DriveItem, FolderItem, FolderRef } from '../../types'

interface MoveDialogProps {
  open: boolean
  mode: 'move' | 'copy'
  items: DriveItem[]
  onClose: () => void
  onConfirm: (target: FolderRef) => Promise<void>
}

/** Selector de carpeta destino para mover o copiar. */
export function MoveDialog({ open, mode, items, onClose, onConfirm }: MoveDialogProps) {
  const [current, setCurrent] = useState<FolderRef>('root')
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [crumbs, setCrumbs] = useState<Breadcrumb[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ids de carpetas que se están moviendo (no se puede entrar/mover a ellas).
  const movingFolderIds = new Set(items.filter((i) => i.type === 'folder').map((i) => i.id))

  useEffect(() => {
    if (open) {
      setCurrent('root')
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    driveApi
      .contents(current)
      .then((data) => {
        setFolders(data.folders)
        setCrumbs(data.breadcrumbs)
      })
      .catch(() => setFolders([]))
      .finally(() => setLoading(false))
  }, [current, open])

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(current)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar')
    } finally {
      setSubmitting(false)
    }
  }

  const parentRef: FolderRef =
    crumbs.length === 0 ? 'root' : crumbs.length === 1 ? 'root' : crumbs[crumbs.length - 2]!.id

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'move' ? 'Mover a' : 'Copiar a'}
      size="md"
    >
      <div className="rounded-drive border border-border">
        {/* Cabecera de navegación */}
        <div className="flex items-center gap-1 border-b border-border px-2 py-2">
          {current !== 'root' && (
            <button
              onClick={() => setCurrent(parentRef)}
              className="rounded-lg p-1 text-content-secondary hover:bg-surface-hover"
              aria-label="Atrás"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <HardDrive size={16} className="text-content-tertiary" />
          <span className="truncate text-sm font-medium text-content-primary">
            {crumbs.length === 0 ? 'Mi unidad' : crumbs[crumbs.length - 1]!.name}
          </span>
        </div>

        {/* Lista de carpetas */}
        <div className="h-64 overflow-y-auto p-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-content-tertiary">
              <Spinner size={24} />
            </div>
          ) : folders.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-content-tertiary">
              No hay subcarpetas
            </p>
          ) : (
            folders.map((f) => {
              const disabled = movingFolderIds.has(f.id)
              return (
                <button
                  key={f.id}
                  disabled={disabled}
                  onClick={() => setCurrent(f.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-surface-hover text-content-primary'
                  )}
                >
                  <Folder size={18} className="shrink-0 text-content-secondary" />
                  <span className="flex-1 truncate">{f.name}</span>
                  {!disabled && <ChevronRight size={16} className="text-content-tertiary" />}
                </button>
              )
            })
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={confirm} loading={submitting}>
          {mode === 'move' ? 'Mover aquí' : 'Copiar aquí'}
        </Button>
      </div>
    </Dialog>
  )
}
