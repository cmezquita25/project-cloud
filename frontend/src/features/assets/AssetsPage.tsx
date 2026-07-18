import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Images,
  FolderPlus,
  Upload,
  ChevronRight,
  Lock,
  MoreVertical,
  FolderOpen,
  Link as LinkIcon,
  Download,
  Trash2,
  X,
} from 'lucide-react'
import { ApiError } from '@shared/api'
import {
  Button,
  Dialog,
  EmptyState,
  Spinner,
  IconButton,
  Menu,
  useToast,
  type MenuItem,
} from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { cn } from '@shared/lib/cn'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { usePreview } from '@features/preview'
import { NamePromptDialog } from '@features/drive-explorer/components/dialogs/NamePromptDialog'
import type { FileItem } from '@features/drive-explorer/types'
import { assetsApi, type AssetFile, type AssetItem, type AssetsListing } from './services/assetsApi'
import { useAssetsAccess } from './hooks/useAssetsAccess'

const isImage = (f: AssetFile) => !!f.mime_type?.startsWith('image/')
const ASSETS_DND = 'application/x-pc-assets'

const toFileItem = (f: AssetFile, id: number): FileItem => ({
  type: 'file',
  id,
  folder_id: null,
  name: f.name,
  path: f.path,
  size_bytes: f.size_bytes,
  mime_type: f.mime_type,
  extension: f.extension,
  is_starred: false,
  url: f.url,
  created_at: null,
  updated_at: null,
})

export function AssetsPage() {
  const toast = useToast()
  const preview = usePreview()
  const { access, loading: accessLoading } = useAssetsAccess()
  const canWrite = access?.can_write ?? false

  const [path, setPath] = useState('')
  const [listing, setListing] = useState<AssetsListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newFolder, setNewFolder] = useState(false)
  const [deleting, setDeleting] = useState<AssetItem | AssetItem[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Interacciones: selección, arrastre interno y menú contextual.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ item: AssetItem | null; x: number; y: number } | null>(null)
  const dragPaths = useRef<string[]>([])

  const load = useCallback((target: string, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    assetsApi
      .list(target, signal)
      .then((data) => {
        setListing(data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof ApiError ? e.message : 'No se pudo cargar la carpeta')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (accessLoading || !access?.allowed) return
    const c = new AbortController()
    load(path, c.signal)
    setSelected(new Set())
    return () => c.abort()
  }, [path, access, accessLoading, load])

  const allItems = useMemo<AssetItem[]>(
    () => [...(listing?.folders ?? []), ...(listing?.files ?? [])],
    [listing]
  )
  const selectedItems = useMemo(() => allItems.filter((i) => selected.has(i.path)), [allItems, selected])
  const fileItems = useMemo(() => (listing?.files ?? []).map((f, i) => toFileItem(f, i + 1)), [listing])

  const clearSelection = () => setSelected(new Set())

  const onItemClick = (item: AssetItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        next.has(item.path) ? next.delete(item.path) : next.add(item.path)
        return next
      })
    } else {
      setSelected(new Set([item.path]))
    }
  }

  const onItemContextMenu = (item: AssetItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selected.has(item.path)) setSelected(new Set([item.path]))
    setCtxMenu({ item, x: e.clientX, y: e.clientY })
  }

  const onBackgroundContextMenu = (e: React.MouseEvent) => {
    if (!canWrite) return
    e.preventDefault()
    setCtxMenu({ item: null, x: e.clientX, y: e.clientY })
  }

  // --- Arrastre para mover ---
  const onDragStart = (item: AssetItem, e: React.DragEvent) => {
    const paths = selected.has(item.path) ? [...selected] : [item.path]
    if (!selected.has(item.path)) setSelected(new Set([item.path]))
    dragPaths.current = paths
    e.dataTransfer.setData(ASSETS_DND, '1')
    e.dataTransfer.effectAllowed = 'move'
  }
  const isInternal = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes(ASSETS_DND)
  const onFolderDragOver = (folderPath: string, e: React.DragEvent) => {
    if (!canWrite || !isInternal(e) || dragPaths.current.includes(folderPath)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(folderPath)
  }
  const onDropOnFolder = async (folderPath: string, e: React.DragEvent) => {
    if (!canWrite || !isInternal(e)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    const paths = dragPaths.current.filter((p) => p !== folderPath && !folderPath.startsWith(p + '/'))
    dragPaths.current = []
    if (paths.length === 0) return
    try {
      for (const p of paths) await assetsApi.move(p, folderPath)
      clearSelection()
      load(path)
      toast.success(paths.length === 1 ? 'Movido' : `${paths.length} elementos movidos`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo mover')
    }
  }

  const openPreview = (file: AssetFile) => {
    const idx = (listing?.files ?? []).findIndex((f) => f.path === file.path)
    preview.open(fileItems[idx] ?? toFileItem(file, 1), fileItems)
  }
  const copyUrl = async (file: AssetFile) => {
    await navigator.clipboard.writeText(file.url)
    toast.success('URL pública copiada')
  }
  const download = (file: AssetFile) => {
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  const createFolder = async (name: string) => {
    await assetsApi.createFolder(path, name)
    load(path)
    toast.success('Carpeta creada')
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const targets = Array.isArray(deleting) ? deleting : [deleting]
    try {
      for (const t of targets) await assetsApi.remove(t.path)
      setDeleting(null)
      clearSelection()
      load(path)
      toast.success(targets.length === 1 ? 'Eliminado' : `${targets.length} elementos eliminados`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar')
    }
  }

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const f of files) await assetsApi.upload(path, f)
      load(path)
      toast.success(files.length === 1 ? 'Archivo subido' : `${files.length} archivos subidos`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo subir')
    } finally {
      setUploading(false)
    }
  }

  // --- Sin acceso ---
  if (accessLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-content-tertiary">
        <Spinner size={32} />
      </div>
    )
  }
  if (!access?.allowed) {
    return (
      <div className="flex h-full flex-col">
        <h1 className="mb-4 text-2xl font-normal text-content-primary">Assets</h1>
        <EmptyState
          icon={Lock}
          title="No tienes acceso a esta carpeta"
          description="La unidad compartida «assets» está restringida. Pide a un administrador que te conceda acceso."
        />
      </div>
    )
  }

  const crumbs = [{ name: 'Assets', path: '' }, ...(listing?.breadcrumbs ?? [])]

  // Acciones del menú contextual.
  const ctxItems = (): MenuItem[] => {
    if (!ctxMenu) return []
    if (ctxMenu.item === null) {
      return [
        { id: 'folder', label: 'Nueva carpeta', icon: FolderPlus, onSelect: () => setNewFolder(true) },
        { id: 'upload', label: 'Subir archivos', icon: Upload, onSelect: () => fileInput.current?.click(), divider: true },
      ]
    }
    const item = ctxMenu.item
    const multi = selectedItems.length > 1 && selected.has(item.path)
    if (multi) {
      return canWrite
        ? [{ id: 'del', label: `Eliminar ${selectedItems.length} elementos`, icon: Trash2, danger: true, onSelect: () => setDeleting(selectedItems) }]
        : []
    }
    if (item.type === 'folder') {
      return [
        { id: 'open', label: 'Abrir', icon: FolderOpen, onSelect: () => setPath(item.path) },
        ...(canWrite ? [{ id: 'del', label: 'Eliminar', icon: Trash2, danger: true, divider: true, onSelect: () => setDeleting(item) }] : []),
      ]
    }
    return [
      { id: 'open', label: 'Vista previa', icon: FolderOpen, onSelect: () => openPreview(item) },
      { id: 'url', label: 'Copiar URL pública', icon: LinkIcon, onSelect: () => void copyUrl(item) },
      { id: 'download', label: 'Descargar', icon: Download, onSelect: () => download(item) },
      ...(canWrite ? [{ id: 'del', label: 'Eliminar', icon: Trash2, danger: true, divider: true, onSelect: () => setDeleting(item) }] : []),
    ]
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="mb-4 flex min-h-[40px] flex-wrap items-center justify-between gap-3">
        {selected.size > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <IconButton icon={X} label="Deseleccionar" size="sm" onClick={clearSelection} />
            <span className="whitespace-nowrap text-sm font-medium text-primary">
              {selected.size} seleccionado(s)
            </span>
            {canWrite && (
              <IconButton icon={Trash2} label="Eliminar" size="sm" onClick={() => setDeleting(selectedItems)} />
            )}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight size={16} className="shrink-0 text-content-tertiary" />}
                <button
                  onClick={() => setPath(c.path)}
                  className={cn(
                    'truncate rounded px-1.5 py-0.5 transition-colors hover:bg-surface-hover',
                    i === crumbs.length - 1 ? 'font-medium text-content-primary' : 'text-content-secondary'
                  )}
                >
                  {i === 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Images size={16} /> {c.name}
                    </span>
                  ) : (
                    c.name
                  )}
                </button>
              </span>
            ))}
          </div>
        )}

        {canWrite && (
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="secondary" leftIcon={FolderPlus} onClick={() => setNewFolder(true)}>
              <span className="hidden sm:inline">Nueva carpeta</span>
            </Button>
            <Button size="sm" leftIcon={Upload} loading={uploading} onClick={() => fileInput.current?.click()}>
              <span className="hidden sm:inline">Subir</span>
            </Button>
            <input ref={fileInput} type="file" multiple hidden onChange={onPickFiles} />
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto" onContextMenu={onBackgroundContextMenu}>
        {loading ? (
          <div className="flex h-64 items-center justify-center text-content-tertiary">
            <Spinner size={32} />
          </div>
        ) : error ? (
          <div className="rounded-drive border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
            {error}
          </div>
        ) : listing && listing.folders.length === 0 && listing.files.length === 0 ? (
          <EmptyState
            icon={Images}
            title="Esta carpeta está vacía"
            description={canWrite ? 'Sube archivos o crea carpetas con los botones de arriba.' : 'No hay elementos para mostrar.'}
          />
        ) : (
          <div className="space-y-6">
            {listing && listing.folders.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-medium text-content-secondary">Carpetas</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listing.folders.map((folder) => (
                    <AssetFolderChip
                      key={folder.path}
                      folder={folder}
                      canWrite={canWrite}
                      selected={selected.has(folder.path)}
                      dropTarget={dropTarget === folder.path}
                      onOpen={() => setPath(folder.path)}
                      onClick={(e) => onItemClick(folder, e)}
                      onContextMenu={(e) => onItemContextMenu(folder, e)}
                      onDragStart={(e) => onDragStart(folder, e)}
                      onDragOver={(e) => onFolderDragOver(folder.path, e)}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => onDropOnFolder(folder.path, e)}
                      onDelete={() => setDeleting(folder)}
                    />
                  ))}
                </div>
              </section>
            )}

            {listing && listing.files.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-medium text-content-secondary">Archivos</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {listing.files.map((file) => (
                    <AssetFileCard
                      key={file.path}
                      file={file}
                      canWrite={canWrite}
                      selected={selected.has(file.path)}
                      onOpen={() => openPreview(file)}
                      onClick={(e) => onItemClick(file, e)}
                      onContextMenu={(e) => onItemContextMenu(file, e)}
                      onDragStart={(e) => onDragStart(file, e)}
                      onCopyUrl={() => void copyUrl(file)}
                      onDownload={() => download(file)}
                      onDelete={() => setDeleting(file)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <NamePromptDialog
        open={newFolder}
        title="Nueva carpeta"
        label="Nombre de la carpeta"
        confirmLabel="Crear"
        onClose={() => setNewFolder(false)}
        onConfirm={createFolder}
      />

      {deleting && (
        <ConfirmDelete items={Array.isArray(deleting) ? deleting : [deleting]} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
      )}

      {ctxMenu && (
        <Menu
          open
          onClose={() => setCtxMenu(null)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          title={ctxMenu.item ? ctxMenu.item.name : 'Assets'}
          items={ctxItems()}
        />
      )}
    </div>
  )
}

// --- Subcomponentes ---

interface FolderChipProps {
  folder: { name: string; path: string }
  canWrite: boolean
  selected: boolean
  dropTarget: boolean
  onOpen: () => void
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onDelete: () => void
}

function AssetFolderChip({
  folder,
  canWrite,
  selected,
  dropTarget,
  onOpen,
  onClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDelete,
}: FolderChipProps) {
  const { icon: Icon, className } = getFileIcon(folder.name, true)
  const menu = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)

  const items: MenuItem[] = [
    { id: 'open', label: 'Abrir', icon: FolderOpen, onSelect: onOpen },
    ...(canWrite
      ? [{ id: 'delete', label: 'Eliminar', icon: Trash2, danger: true, divider: true, onSelect: onDelete }]
      : []),
  ]

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'group flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors cursor-pointer',
        dropTarget
          ? 'border-primary bg-primary-subtle ring-2 ring-primary'
          : selected
            ? 'border-primary bg-primary-subtle'
            : 'border-border bg-surface-container hover:bg-surface-hover'
      )}
    >
      <Icon size={22} className={cn('shrink-0', className)} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">{folder.name}</span>
      <div ref={anchor} className="relative">
        <IconButton icon={MoreVertical} label="Más acciones" size="sm" active={menu.isOpen} onClick={(e) => { e.stopPropagation(); menu.toggle() }} />
        <Menu open={menu.isOpen} onClose={menu.close} items={items} title={folder.name} align="right" anchorRef={anchor} />
      </div>
    </div>
  )
}

interface FileCardProps {
  file: AssetFile
  canWrite: boolean
  selected: boolean
  onOpen: () => void
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onCopyUrl: () => void
  onDownload: () => void
  onDelete: () => void
}

function AssetFileCard({
  file,
  canWrite,
  selected,
  onOpen,
  onClick,
  onContextMenu,
  onDragStart,
  onCopyUrl,
  onDownload,
  onDelete,
}: FileCardProps) {
  const { icon: Icon, className } = getFileIcon(file.name, false)
  const menu = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)

  const items: MenuItem[] = [
    { id: 'open', label: 'Vista previa', icon: FolderOpen, onSelect: onOpen },
    { id: 'url', label: 'Copiar URL pública', icon: LinkIcon, onSelect: onCopyUrl },
    { id: 'download', label: 'Descargar', icon: Download, onSelect: onDownload },
    ...(canWrite
      ? [{ id: 'delete', label: 'Eliminar', icon: Trash2, danger: true, divider: true, onSelect: onDelete }]
      : []),
  ]

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border transition-shadow cursor-pointer',
        selected ? 'border-primary bg-primary-subtle' : 'border-border bg-surface hover:shadow-elevation-1'
      )}
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-surface-container">
        {isImage(file) ? (
          <img src={file.url} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon size={52} className={cn('opacity-70', className)} strokeWidth={1.5} />
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
        <Icon size={18} className={cn('shrink-0', className)} />
        <span className="min-w-0 flex-1 truncate text-sm text-content-primary" title={file.name}>
          {file.name}
        </span>
        <span className="hidden shrink-0 text-xs text-content-tertiary sm:block">{formatBytes(file.size_bytes)}</span>
        <div ref={anchor} className="relative">
          <IconButton icon={MoreVertical} label="Más acciones" size="sm" active={menu.isOpen} onClick={(e) => { e.stopPropagation(); menu.toggle() }} />
          <Menu open={menu.isOpen} onClose={menu.close} items={items} title={file.name} align="right" anchorRef={anchor} />
        </div>
      </div>
    </div>
  )
}

function ConfirmDelete({
  items,
  onCancel,
  onConfirm,
}: {
  items: AssetItem[]
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }
  const target = items.length === 1 ? `"${items[0]!.name}"` : `${items.length} elementos`
  return (
    <Dialog
      open
      onClose={() => (busy ? undefined : onCancel())}
      title="Eliminar definitivamente"
      description={`Se eliminará ${target} para siempre de la carpeta compartida. Esta acción no se puede deshacer.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={run} loading={busy}>
            Eliminar
          </Button>
        </>
      }
    />
  )
}
