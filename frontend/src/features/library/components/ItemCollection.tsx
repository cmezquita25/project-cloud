import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, FolderInput, Copy, Trash2, type LucideIcon } from 'lucide-react'
import { EmptyState, Spinner, IconButton, useToast } from '@shared/ui'
import { usePreview } from '@features/preview'
import { driveApi } from '@features/drive-explorer/services/driveApi'
import { ViewToggle } from '@features/drive-explorer/components/ViewToggle'
import { FileListView } from '@features/drive-explorer/components/FileListView'
import { FileGridView } from '@features/drive-explorer/components/FileGridView'
import { DetailsPanel } from '@features/drive-explorer/components/DetailsPanel'
import { NamePromptDialog } from '@features/drive-explorer/components/dialogs/NamePromptDialog'
import { MoveDialog } from '@features/drive-explorer/components/dialogs/MoveDialog'
import { DeleteDialog } from '@features/drive-explorer/components/dialogs/DeleteDialog'
import type { DriveItem, FolderRef, ItemAction, ViewMode } from '@features/drive-explorer/types'

interface EmptyConfig {
  icon: LucideIcon
  title: string
  description: string
}

interface ItemCollectionProps {
  items: DriveItem[]
  loading: boolean
  error: string | null
  reload: () => void
  empty: EmptyConfig
}

type DialogState =
  | { kind: 'rename'; item: DriveItem }
  | { kind: 'move'; mode: 'move' | 'copy'; items: DriveItem[] }
  | { kind: 'delete'; items: DriveItem[] }
  | null

const key = (i: DriveItem) => `${i.type}-${i.id}`

/**
 * Colección reutilizable de elementos (Fase 7): recientes, destacados y
 * búsqueda comparten la misma cuadrícula/lista, selección múltiple, panel de
 * detalles, vista previa y acciones que el explorador.
 */
export function ItemCollection({ items, loading, error, reload, empty }: ItemCollectionProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const preview = usePreview()

  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('pc-view') as ViewMode) || 'list'
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<DriveItem | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const selectedItems = useMemo(() => items.filter((i) => selected.has(key(i))), [items, selected])
  const clearSelection = () => setSelected(new Set())

  const setViewMode = (m: ViewMode) => {
    setView(m)
    localStorage.setItem('pc-view', m)
  }

  const openItem = (item: DriveItem) => {
    if (item.type === 'folder') navigate(`/folder/${item.id}`)
    else preview.open(item, items)
  }

  const toggleSelect = (item: DriveItem) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = key(item)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  async function runStar(item: DriveItem) {
    const fn = item.type === 'folder' ? driveApi.starFolder : driveApi.starFile
    await fn(item.id, !item.is_starred)
    reload()
  }

  async function runDelete(targets: DriveItem[]) {
    for (const it of targets) {
      await (it.type === 'folder' ? driveApi.deleteFolder(it.id) : driveApi.deleteFile(it.id))
    }
    clearSelection()
    reload()
    toast.success(targets.length === 1 ? 'Enviado a la papelera' : `${targets.length} elementos en la papelera`)
  }

  async function copyUrl(item: DriveItem) {
    if (item.type !== 'file') return
    await navigator.clipboard.writeText(item.url)
    toast.success('URL pública copiada')
  }

  function download(item: DriveItem) {
    if (item.type !== 'file') return
    const a = document.createElement('a')
    a.href = item.url
    a.download = item.name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const onAction = (item: DriveItem, action: ItemAction) => {
    switch (action) {
      case 'open':
        return openItem(item)
      case 'details':
        return setDetails(item)
      case 'download':
        return download(item)
      case 'copyUrl':
        return void copyUrl(item)
      case 'star':
        return void runStar(item).catch((e) => toast.error(e.message))
      case 'duplicate':
        return void driveApi
          .duplicateFile(item.id)
          .then(() => {
            reload()
            toast.success('Duplicado')
          })
          .catch((e) => toast.error(e.message))
      case 'rename':
        return setDialog({ kind: 'rename', item })
      case 'move':
        return setDialog({ kind: 'move', mode: 'move', items: [item] })
      case 'copy':
        return setDialog({ kind: 'move', mode: 'copy', items: [item] })
      case 'delete':
        return setDialog({ kind: 'delete', items: [item] })
    }
  }

  const renameItem = async (name: string) => {
    if (dialog?.kind !== 'rename') return
    const it = dialog.item
    await (it.type === 'folder' ? driveApi.renameFolder(it.id, name) : driveApi.renameFile(it.id, name))
    reload()
  }

  const moveOrCopy = async (target: FolderRef) => {
    if (dialog?.kind !== 'move') return
    const { mode, items: targets } = dialog
    for (const it of targets) {
      if (mode === 'move') {
        await (it.type === 'folder' ? driveApi.moveFolder(it.id, target) : driveApi.moveFile(it.id, target))
      } else {
        await (it.type === 'folder' ? driveApi.copyFolder(it.id, target) : driveApi.copyFile(it.id, target))
      }
    }
    clearSelection()
    reload()
    toast.success(mode === 'move' ? 'Movido' : 'Copiado')
  }

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra de herramientas */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm text-content-tertiary">
            {items.length > 0 ? `${items.length} elemento(s)` : ''}
          </span>
          <ViewToggle value={view} onChange={setViewMode} />
        </div>

        {/* Barra de selección */}
        {selected.size > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-pill bg-primary-subtle px-3 py-1.5">
            <IconButton icon={X} label="Deseleccionar" size="sm" onClick={clearSelection} />
            <span className="text-sm font-medium text-primary">{selected.size} seleccionado(s)</span>
            <div className="ml-auto flex items-center gap-1">
              <IconButton icon={FolderInput} label="Mover" size="sm" onClick={() => setDialog({ kind: 'move', mode: 'move', items: selectedItems })} />
              <IconButton icon={Copy} label="Copiar" size="sm" onClick={() => setDialog({ kind: 'move', mode: 'copy', items: selectedItems })} />
              <IconButton icon={Trash2} label="Eliminar" size="sm" onClick={() => setDialog({ kind: 'delete', items: selectedItems })} />
            </div>
          </div>
        )}

        {/* Contenido */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-content-tertiary">
              <Spinner size={32} />
            </div>
          ) : error ? (
            <div className="rounded-drive border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
              {error}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
          ) : view === 'list' ? (
            <FileListView items={items} selected={selected} onOpen={openItem} onSelectToggle={toggleSelect} onAction={onAction} />
          ) : (
            <FileGridView items={items} selected={selected} onOpen={openItem} onSelectToggle={toggleSelect} onAction={onAction} />
          )}
        </div>
      </div>

      {/* Panel de detalles */}
      {details && (
        <div className="ml-4 hidden w-80 shrink-0 overflow-hidden rounded-drive border border-border lg:block">
          <DetailsPanel item={details} onClose={() => setDetails(null)} />
        </div>
      )}

      {/* Diálogos */}
      <NamePromptDialog
        open={dialog?.kind === 'rename'}
        title="Cambiar nombre"
        label="Nuevo nombre"
        confirmLabel="Guardar"
        initialValue={dialog?.kind === 'rename' ? dialog.item.name : ''}
        onClose={() => setDialog(null)}
        onConfirm={renameItem}
      />
      <MoveDialog
        open={dialog?.kind === 'move'}
        mode={dialog?.kind === 'move' ? dialog.mode : 'move'}
        items={dialog?.kind === 'move' ? dialog.items : []}
        onClose={() => setDialog(null)}
        onConfirm={moveOrCopy}
      />
      <DeleteDialog
        open={dialog?.kind === 'delete'}
        items={dialog?.kind === 'delete' ? dialog.items : []}
        onClose={() => setDialog(null)}
        onConfirm={() => runDelete(dialog?.kind === 'delete' ? dialog.items : [])}
      />
    </div>
  )
}
