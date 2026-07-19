import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FolderPlus,
  UploadCloud,
  X,
  FolderInput,
  Copy,
  Trash2,
  FileUp,
  FolderUp,
  FolderSymlink,
  Search,
  FileType2,
  Users,
  ChevronDown,
  Download,
} from 'lucide-react'
import { Button, EmptyState, Spinner, IconButton, Menu, useToast, type MenuItem } from '@shared/ui'
import { useUploads } from '@features/uploads/UploadProvider'
import { useUploadPicker } from '@features/uploads/hooks/useUploadPicker'
import { usePreview } from '@features/preview'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'
import { useHeaderSearch } from '@app/layouts/HeaderSearchContext'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useAuth } from '@features/auth/AuthProvider'
import { useFolderContents } from './hooks/useFolderContents'
import { driveApi } from './services/driveApi'
import { Breadcrumbs } from './components/Breadcrumbs'
import { ViewToggle } from './components/ViewToggle'
import { FileListView } from './components/FileListView'
import { FileGridView } from './components/FileGridView'
import { SortControl, sortDriveItems, useSortState } from './components/SortControl'
import { DetailsPanel } from './components/DetailsPanel'
import { NamePromptDialog } from './components/dialogs/NamePromptDialog'
import { DeleteDialog } from './components/dialogs/DeleteDialog'
import { MoveDialog } from './components/dialogs/MoveDialog'
import { buildItemMenu } from './components/itemMenu'
import { useMarqueeSelection } from './hooks/useMarqueeSelection'
import { dragState, isInternalDrag, PC_DND_MIME } from './services/dragState'
import type { DriveItem, FolderItem, FolderRef, ItemAction, ItemInteractions, ViewMode } from './types'

const key = (i: DriveItem) => `${i.type}-${i.id}`

type DialogState =
  | { kind: 'newFolder' }
  | { kind: 'rename'; item: DriveItem }
  | { kind: 'move'; mode: 'move' | 'copy'; items: DriveItem[] }
  | { kind: 'delete'; items: DriveItem[] }
  | null

export function DriveExplorerPage() {
  const params = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const folderId: FolderRef = params.folderId ? Number(params.folderId) : 'root'
  const { data, loading, error, reload } = useFolderContents(folderId)

  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('pc-view') as ViewMode) || 'list'
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<DriveItem | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  // Selección con teclado/ratón (ancla para rangos con Shift).
  const anchorIndex = useRef<number | null>(null)
  // Arrastre interno (mover) y menú contextual.
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ item: DriveItem | null; x: number; y: number } | null>(null)

  const { enqueue, completion } = useUploads()
  const { pickFiles, pickFolder } = useUploadPicker(folderId)
  const preview = usePreview()
  const { access: assetsAccess } = useAssetsAccess()
  const settings = usePlatformSettings()
  const { user } = useAuth()
  const atRoot = folderId === 'root'

  // Home: buscador "hero" + colapso hacia el Header al hacer scroll (escritorio).
  const { setShowInHeader } = useHeaderSearch()
  const scrollRef = useRef<HTMLDivElement>(null)
  const heroSentinelRef = useRef<HTMLDivElement>(null)
  const [heroTerm, setHeroTerm] = useState('')

  useEffect(() => {
    // Fuera de la raíz, el buscador vive siempre en el Header.
    if (!atRoot) {
      setShowInHeader(true)
      return
    }
    const sentinel = heroSentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root) return
    const obs = new IntersectionObserver(
      (entries) => setShowInHeader(!entries[0]?.isIntersecting),
      { root, threshold: 0 }
    )
    obs.observe(sentinel)
    return () => {
      obs.disconnect()
      setShowInHeader(true)
    }
  }, [atRoot, loading, setShowInHeader])

  const submitHeroSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = heroTerm.trim()
    navigate(q === '' ? '/search' : `/search?q=${encodeURIComponent(q)}`)
  }

  // Selección por área (lazo) sobre la zona de contenido.
  const marqueeBase = useRef<Set<string>>(new Set())
  const { overlay: marqueeOverlay } = useMarqueeSelection({
    containerRef: scrollRef,
    onBegin: (additive) => {
      marqueeBase.current = additive ? new Set(selected) : new Set()
      if (!additive) setSelected(new Set())
    },
    onSelect: (keys) => setSelected(new Set([...marqueeBase.current, ...keys])),
  })

  // Recarga cuando una subida se completa (aparecen archivos/carpetas nuevos).
  const lastTick = useRef(0)
  useEffect(() => {
    if (completion.tick !== lastTick.current) {
      lastTick.current = completion.tick
      reload()
    }
  }, [completion.tick, reload])

  // Permite abrir "Nueva carpeta" desde el botón Nuevo del sidebar.
  useEffect(() => {
    const handler = () => setDialog({ kind: 'newFolder' })
    window.addEventListener('pc:new-folder', handler)
    return () => window.removeEventListener('pc:new-folder', handler)
  }, [])

  const [sort, setSort] = useSortState()
  const items = useMemo<DriveItem[]>(
    () => sortDriveItems([...(data?.folders ?? []), ...(data?.files ?? [])], sort),
    [data, sort]
  )
  const selectedItems = useMemo(() => items.filter((i) => selected.has(key(i))), [items, selected])

  // Atajos de teclado: Ctrl/Cmd+A selecciona todo, Esc limpia, Supr envía a papelera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(new Set(items.map(key)))
      } else if (e.key === 'Escape') {
        setSelected(new Set())
        setCtxMenu(null)
      } else if (e.key === 'Delete' && selectedItems.length > 0) {
        setDialog({ kind: 'delete', items: selectedItems })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, selectedItems])

  const setViewMode = (m: ViewMode) => {
    setView(m)
    localStorage.setItem('pc-view', m)
  }

  const openItem = (item: DriveItem) => {
    if (item.type === 'folder') {
      setSelected(new Set())
      navigate(`/folder/${item.id}`)
    } else {
      preview.open(item, items)
    }
  }

  const toggleSelect = (item: DriveItem) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = key(item)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  // --- Selección estilo Drive: clic simple, Ctrl/Cmd alterna, Shift rango ---
  const onItemClick = (item: DriveItem, e: React.MouseEvent) => {
    const index = items.findIndex((i) => key(i) === key(item))
    if (e.shiftKey && anchorIndex.current !== null) {
      const a = Math.min(anchorIndex.current, index)
      const b = Math.max(anchorIndex.current, index)
      setSelected(new Set(items.slice(a, b + 1).map(key)))
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        const k = key(item)
        next.has(k) ? next.delete(k) : next.add(k)
        return next
      })
      anchorIndex.current = index
    } else {
      setSelected(new Set([key(item)]))
      anchorIndex.current = index
    }
  }

  // --- Menú contextual (clic derecho) ---
  const onItemContextMenu = (item: DriveItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selected.has(key(item))) {
      setSelected(new Set([key(item)]))
      anchorIndex.current = items.findIndex((i) => key(i) === key(item))
    }
    setCtxMenu({ item, x: e.clientX, y: e.clientY })
  }

  const onBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ item: null, x: e.clientX, y: e.clientY })
  }

  // --- Arrastre interno (mover a carpetas/subcarpetas) ---
  const onItemDragStart = (item: DriveItem, e: React.DragEvent) => {
    const dragItems = selected.has(key(item)) ? selectedItems : [item]
    if (!selected.has(key(item))) setSelected(new Set([key(item)]))
    dragState.set(dragItems)
    e.dataTransfer.setData(PC_DND_MIME, '1')
    e.dataTransfer.effectAllowed = 'move'
  }

  const onItemDragEnd = () => {
    dragState.clear()
    setDropTargetKey(null)
  }

  const onFolderDragOver = (folder: FolderItem, e: React.DragEvent) => {
    if (!isInternalDrag(e)) return
    if (dragState.get().some((d) => key(d) === `folder-${folder.id}`)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetKey(`folder-${folder.id}`)
  }

  const onFolderDragLeave = () => setDropTargetKey(null)

  const onDropOnFolder = async (folder: FolderItem, e: React.DragEvent) => {
    if (!isInternalDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTargetKey(null)
    const moving = dragState.get().filter((d) => key(d) !== `folder-${folder.id}`)
    dragState.clear()
    if (moving.length === 0) return
    try {
      for (const it of moving) {
        await (it.type === 'folder'
          ? driveApi.moveFolder(it.id, folder.id)
          : driveApi.moveFile(it.id, folder.id))
      }
      clearSelection()
      reload()
      toast.success(moving.length === 1 ? 'Movido' : `${moving.length} elementos movidos`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo mover')
    }
  }

  const interactions: ItemInteractions = {
    onItemClick,
    onItemContextMenu,
    dragEnabled: true,
    onItemDragStart,
    onItemDragEnd,
    onDropOnFolder,
    onFolderDragOver,
    onFolderDragLeave,
    dropTargetKey,
  }

  // --- Acciones ---
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

  // --- Handlers de diálogos ---
  const createFolder = async (name: string) => {
    await driveApi.createFolder(folderId, name)
    reload()
    toast.success('Carpeta creada')
  }

  const renameItem = async (name: string) => {
    if (dialog?.kind !== 'rename') return
    const it = dialog.item
    await (it.type === 'folder' ? driveApi.renameFolder(it.id, name) : driveApi.renameFile(it.id, name))
    reload()
  }

  const newMenuItems: MenuItem[] = [
    { id: 'folder', label: 'Nueva carpeta', icon: FolderPlus, onSelect: () => setDialog({ kind: 'newFolder' }) },
    { id: 'files', label: 'Subir archivos', icon: FileUp, onSelect: pickFiles, divider: true },
    { id: 'dir', label: 'Subir carpeta', icon: FolderUp, onSelect: pickFolder },
  ]

  // --- Drag & drop desde el SO ---
  // Solo tratamos como subida un arrastre EXTERNO real de archivos: debe traer
  // 'Files' y NO ser un arrastre interno (mover elementos) ni tener elementos
  // en curso en dragState. Esto evita el bug de duplicado al arrastrar miniaturas.
  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('Files') && !isInternalDrag(e) && dragState.get().length === 0
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (hasFiles(e)) e.preventDefault()
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    dragCounter.current--
    if (dragCounter.current <= 0) setDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) enqueue(files, folderId)
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
    <div
      className="relative flex h-full"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Overlay de arrastre */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-overlay flex items-center justify-center rounded-drive border-2 border-dashed border-primary bg-primary-subtle/80">
          <div className="flex flex-col items-center gap-2 text-primary">
            <UploadCloud size={48} />
            <p className="text-lg font-medium">Suelta para subir aquí</p>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera: migas o, si hay selección, controles de selección (misma
            altura para evitar saltos de layout). */}
        <div className="mb-4 flex h-10 items-center justify-between gap-3">
          {selected.size > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              <IconButton icon={X} label="Deseleccionar" size="sm" onClick={clearSelection} />
              <span className="whitespace-nowrap text-sm font-medium text-primary">
                {selected.size} seleccionado(s)
              </span>
              <div className="flex items-center gap-1">
                {/* Solo archivos → se habilita Descargar (acción exclusiva de archivos). */}
                {selectedItems.length > 0 && selectedItems.every((i) => i.type === 'file') && (
                  <IconButton icon={Download} label="Descargar" size="sm" onClick={() => selectedItems.forEach(download)} />
                )}
                <IconButton icon={FolderInput} label="Mover" size="sm" onClick={() => setDialog({ kind: 'move', mode: 'move', items: selectedItems })} />
                <IconButton icon={Copy} label="Copiar" size="sm" onClick={() => setDialog({ kind: 'move', mode: 'copy', items: selectedItems })} />
                <IconButton icon={Trash2} label="Eliminar" size="sm" onClick={() => setDialog({ kind: 'delete', items: selectedItems })} />
              </div>
            </div>
          ) : (
            <Breadcrumbs
              crumbs={data?.breadcrumbs ?? []}
              onNavigate={(id) => navigate(id === 'root' ? '/' : `/folder/${id}`)}
            />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <SortControl value={sort} onChange={setSort} />
            <ViewToggle value={view} onChange={setViewMode} />
          </div>
        </div>

        {/* Contenido */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" onContextMenu={onBackgroundContextMenu}>
          {/* Hero de bienvenida (solo en Mi unidad / raíz). El buscador se
              colapsa hacia el Header al hacer scroll. */}
          {atRoot && (
            <div className="mb-8 flex flex-col items-center px-2 pt-4 text-center sm:pt-8">
              <h1 className="mb-6 text-2xl font-normal text-content-primary sm:text-[28px]">
                Te damos la bienvenida a {settings?.organization_name || 'Drive'}
              </h1>
              <form
                onSubmit={submitHeroSearch}
                role="search"
                className="flex h-12 w-full max-w-2xl items-center gap-3 rounded-pill border border-border bg-surface-container px-5 text-content-secondary transition-colors focus-within:bg-surface focus-within:shadow-elevation-1"
              >
                <button type="submit" aria-label="Buscar" className="shrink-0 focus-visible:outline-focus">
                  <Search size={20} />
                </button>
                <input
                  type="search"
                  value={heroTerm}
                  onChange={(e) => setHeroTerm(e.target.value)}
                  placeholder={`Buscar en ${settings?.organization_name || 'Drive'}`}
                  aria-label="Buscar"
                  className="min-w-0 flex-1 bg-transparent text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:appearance-none"
                />
              </form>

              {/* Sentinela: al salir de la vista, el buscador reaparece en el Header. */}
              <div ref={heroSentinelRef} aria-hidden className="mt-4 h-px w-full" />

              {/* Filtros (aún no implementados: se muestran como próximos). */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {[
                  { label: 'Tipo', icon: FileType2 },
                  { label: 'Personas', icon: Users },
                ].map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    title="Próximamente"
                    className="flex cursor-not-allowed items-center gap-2 rounded-pill border border-border bg-surface-container px-3.5 py-1.5 text-sm text-content-secondary opacity-70"
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    <ChevronDown size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Acceso a la unidad compartida "assets": dentro de Mi unidad (solo en
              la raíz y si el usuario tiene acceso). La carpeta raíz no se puede
              eliminar; su contenido se edita desde el explorador de assets. */}
          {atRoot && assetsAccess?.allowed && (
            <button
              onClick={() => navigate('/assets')}
              className="group mb-4 flex w-full items-center gap-3 rounded-xl border border-border bg-surface-container px-3 py-3 text-left transition-colors hover:bg-surface-hover sm:max-w-xs"
            >
              <FolderSymlink size={22} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content-primary">Unidad compartida</p>
                <p className="truncate text-xs text-content-tertiary">Carpeta compartida del equipo</p>
              </div>
            </button>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center text-content-tertiary">
              <Spinner size={32} />
            </div>
          ) : error ? (
            <div className="rounded-drive border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
              {error}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={UploadCloud}
              title="Esta carpeta está vacía"
              description="Arrastra archivos aquí, o usa el botón «Nuevo» para subir archivos y crear carpetas."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button leftIcon={FileUp} onClick={pickFiles}>
                    Subir archivos
                  </Button>
                  <Button variant="secondary" leftIcon={FolderPlus} onClick={() => setDialog({ kind: 'newFolder' })}>
                    Nueva carpeta
                  </Button>
                </div>
              }
            />
          ) : view === 'list' ? (
            <FileListView items={items} selected={selected} onOpen={openItem} onSelectToggle={toggleSelect} onAction={onAction} interactions={interactions} ownerName={user?.display_name} />
          ) : (
            <FileGridView items={items} selected={selected} onOpen={openItem} onSelectToggle={toggleSelect} onAction={onAction} interactions={interactions} />
          )}
        </div>
      </div>

      {/* Rectángulo de selección por área */}
      {marqueeOverlay}

      {/* Panel de detalles */}
      {details && (
        <div className="ml-4 hidden w-80 shrink-0 overflow-hidden rounded-drive border border-border lg:block">
          <DetailsPanel item={details} onClose={() => setDetails(null)} />
        </div>
      )}

      {/* Diálogos */}
      <NamePromptDialog
        open={dialog?.kind === 'newFolder'}
        title="Nueva carpeta"
        label="Nombre de la carpeta"
        confirmLabel="Crear"
        onClose={() => setDialog(null)}
        onConfirm={createFolder}
      />
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

      {/* Menú contextual (clic derecho): elemento, selección múltiple o fondo. */}
      {ctxMenu && (
        <Menu
          open
          onClose={() => setCtxMenu(null)}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          title={ctxMenu.item ? ctxMenu.item.name : 'Nuevo'}
          items={
            ctxMenu.item === null
              ? newMenuItems
              : selectedItems.length > 1 && selected.has(key(ctxMenu.item))
                ? [
                    {
                      id: 'move',
                      label: `Mover ${selectedItems.length} elementos`,
                      icon: FolderInput,
                      onSelect: () => setDialog({ kind: 'move', mode: 'move', items: selectedItems }),
                    },
                    {
                      id: 'copy',
                      label: 'Copiar a',
                      icon: Copy,
                      onSelect: () => setDialog({ kind: 'move', mode: 'copy', items: selectedItems }),
                    },
                    {
                      id: 'delete',
                      label: 'Enviar a la papelera',
                      icon: Trash2,
                      danger: true,
                      divider: true,
                      onSelect: () => setDialog({ kind: 'delete', items: selectedItems }),
                    },
                  ]
                : buildItemMenu(ctxMenu.item, (a) => onAction(ctxMenu.item!, a))
          }
        />
      )}
    </div>
  )
}
