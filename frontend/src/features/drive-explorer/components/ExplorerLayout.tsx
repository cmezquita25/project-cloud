import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Download,
  Info,
} from 'lucide-react'
import { Button, EmptyState, Spinner, IconButton, Menu, useToast, type MenuItem } from '@shared/ui'
import { useUploads } from '@features/uploads/UploadProvider'
import { useUploadPicker } from '@features/uploads/hooks/useUploadPicker'
import { usePreview } from '@features/preview'
import { useAssetsAccess } from '@features/assets/hooks/useAssetsAccess'
import { useHeaderSearch } from '@app/layouts/HeaderSearchContext'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { useAuth } from '@features/auth/AuthProvider'
import { useFolderContents } from '../hooks/useFolderContents'
import type { IExplorerAdapter } from '../adapters/types'
import { Breadcrumbs } from './Breadcrumbs'
import { ViewToggle } from './ViewToggle'
import { SearchFilterBar } from '@features/search/components/SearchFilterBar'
import { FileListView } from './FileListView'
import { FileGridView } from './FileGridView'
import { SortControl, useSortState } from './SortControl'
import { DetailsPanel } from './DetailsPanel'
import { NamePromptDialog } from './dialogs/NamePromptDialog'
import { DeleteDialog } from './dialogs/DeleteDialog'
import { MoveDialog } from './dialogs/MoveDialog'
import { BlockActionsDialog } from '@features/assets/components/BlockActionsDialog'
import { buildItemMenu } from './itemMenu'
import { useMarqueeSelection } from '../hooks/useMarqueeSelection'
import { dragState, isInternalDrag, PC_DND_MIME } from '../services/dragState'
import type { DriveItem, FolderItem, FolderRef, ItemAction, ItemInteractions, ViewMode } from '../types'

const key = (i: DriveItem) => `${i.type}-${i.id}`

type DialogState =
  | { kind: 'newFolder' }
  | { kind: 'rename'; item: DriveItem }
  | { kind: 'move'; mode: 'move' | 'copy'; items: DriveItem[] }
  | { kind: 'delete'; items: DriveItem[] }
  | { kind: 'block'; item: DriveItem }
  | null

interface ExplorerLayoutProps {
  folderId: FolderRef
  adapter: IExplorerAdapter
  heroSearch?: boolean
}

export function ExplorerLayout({ folderId, adapter, heroSearch = false }: ExplorerLayoutProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? undefined
  const typeFilter = searchParams.get('type') ?? ''
  const dateFilter = searchParams.get('date') ?? ''
  const toast = useToast()

  const [sort, setSort] = useSortState()
  const { data, loading, error, reload, loadingMore, hasMore, loadMore } = useFolderContents(folderId, sort, adapter, q, typeFilter, dateFilter)

  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('pc-view') as ViewMode) || 'list'
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDetails, setShowDetails] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  // Selección con teclado/ratón (ancla para rangos con Shift).
  const anchorIndex = useRef<number | null>(null)
  // Arrastre interno (mover) y menú contextual.
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ item: DriveItem | null; x: number; y: number } | null>(null)

  const { enqueue, completion } = useUploads()
  const { pickFiles, pickFolder } = useUploadPicker(folderId, adapter.mode)
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
    if (!heroSearch || !atRoot) {
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
    const query = heroTerm.trim()
    if (adapter.mode === 'assets') {
      if (query === '') {
        searchParams.delete('q')
      } else {
        searchParams.set('q', query)
      }
      setSearchParams(searchParams)
    } else {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (typeFilter) params.set('type', typeFilter)
      if (dateFilter) params.set('date', dateFilter)
      navigate('/search?' + params.toString())
    }
  }

  // Selección por área (lazo) sobre la zona de contenido.
  const marqueeBase = useRef<Set<string>>(new Set())
  const { overlay: marqueeOverlay } = useMarqueeSelection({
    containerRef: scrollRef,
    onBegin: (additive: boolean) => {
      marqueeBase.current = additive ? new Set(selected) : new Set()
      if (!additive) setSelected(new Set())
    },
    onSelect: (keys: string[]) => setSelected(new Set([...marqueeBase.current, ...keys])),
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

  const items = useMemo<DriveItem[]>(
    () => (data ? [...data.folders, ...data.files] : []),
    [data]
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
      navigate(adapter.mode === 'assets' ? `/assets/${item.id}` : `/folder/${item.id}`)
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
      if (moving.length > 0) {
        await adapter.moveItems(moving, folder.id)
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
    if (!adapter.capabilities.canStar) return
    await adapter.starItem(item, !item.is_starred)
    reload()
  }

  async function runDelete(targets: DriveItem[]) {
    if (!adapter.capabilities.canDelete) return
    await adapter.deleteItems(targets)
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
    const url = adapter.getDownloadUrl(item)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
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
        return setShowDetails(true)
      case 'download':
        return download(item)
      case 'copyUrl':
        return void copyUrl(item)
      case 'star':
        return void runStar(item).catch((e) => toast.error(e.message))
      case 'duplicate':
        if (!adapter.capabilities.canDuplicate) return
        return void adapter.duplicateItem(item)
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
      case 'restore':
        return void adapter.restoreItem?.(item)
          .then(() => {
            reload()
            toast.success('Restaurado')
          })
          .catch((e) => toast.error(e.message))
      case 'block':
        return setDialog({ kind: 'block', item })
    }
  }

  // --- Handlers de diálogos ---
  const createFolder = async (name: string) => {
    if (!adapter.capabilities.canWrite) return
    await adapter.createFolder(folderId, name)
    reload()
    toast.success('Carpeta creada')
  }

  const renameItem = async (name: string) => {
    if (dialog?.kind !== 'rename' || !adapter.capabilities.canRename) return
    await adapter.renameItem(dialog.item, name)
    reload()
  }

  const newMenuItems: MenuItem[] = [
    { id: 'folder', label: 'Nueva carpeta', icon: FolderPlus, onSelect: () => setDialog({ kind: 'newFolder' }) },
    { id: 'files', label: 'Subir archivos', icon: FileUp, onSelect: pickFiles, divider: true },
    { id: 'dir', label: 'Subir carpeta', icon: FolderUp, onSelect: pickFolder },
  ]

  // --- Drag & drop desde el SO ---
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
    if (files.length > 0) enqueue(files, folderId, adapter.mode)
  }

  const moveOrCopy = async (target: FolderRef) => {
    if (dialog?.kind !== 'move') return
    const { mode, items: targets } = dialog

    if (mode === 'move' && adapter.capabilities.canMove) {
      await adapter.moveItems(targets, target)
    } else if (mode === 'copy' && adapter.capabilities.canCopy) {
      await adapter.copyItems(targets, target)
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
        <div className="mb-4 flex h-10 items-center justify-between gap-3">
          {selected.size > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              <IconButton icon={X} label="Deseleccionar" size="sm" onClick={clearSelection} />
              <span className="whitespace-nowrap text-sm font-medium text-primary">
                {selected.size} seleccionado(s)
              </span>
              <div className="flex items-center gap-1">
                {selectedItems.length > 0 && selectedItems.every((i) => i.type === 'file') && adapter.capabilities.canDownload && (
                  <IconButton icon={Download} label="Descargar" size="sm" onClick={() => selectedItems.forEach(download)} />
                )}
                {adapter.capabilities.canMove && (
                  <IconButton icon={FolderInput} label="Mover" size="sm" onClick={() => setDialog({ kind: 'move', mode: 'move', items: selectedItems })} />
                )}
                {adapter.capabilities.canCopy && (
                  <IconButton icon={Copy} label="Copiar" size="sm" onClick={() => setDialog({ kind: 'move', mode: 'copy', items: selectedItems })} />
                )}
                {adapter.capabilities.canDelete && (
                  <IconButton icon={Trash2} label="Eliminar" size="sm" onClick={() => setDialog({ kind: 'delete', items: selectedItems })} />
                )}
              </div>
            </div>
          ) : (
            <Breadcrumbs
              crumbs={data?.breadcrumbs ?? []}
              rootLabel={adapter.mode === 'assets' ? 'Unidad compartida' : 'Mi unidad'}
              onNavigate={(id: FolderRef) => navigate(adapter.mode === 'assets' ? (id === 'root' ? '/assets' : `/assets/${id}`) : (id === 'root' ? '/' : `/folder/${id}`))}
            />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <SortControl value={sort} onChange={setSort} />
            <ViewToggle value={view} onChange={setViewMode} />
            <IconButton icon={Info} label="Detalles" size="sm" active={showDetails} onClick={() => setShowDetails(!showDetails)} />
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" onContextMenu={onBackgroundContextMenu}>
          {atRoot && (
            <div className="mb-8 flex flex-col items-center px-2 pt-4 text-center sm:pt-8">
              <h1 className="mb-6 text-2xl font-normal text-content-primary sm:text-[28px]">
                {adapter.mode === 'assets' ? 'Unidad compartida' : `Te damos la bienvenida a ${settings?.organization_name || 'Drive'}`}
              </h1>
              {adapter.mode === 'assets' && q && (
                <div className="mb-4 text-sm text-content-secondary">
                  Resultados para: <span className="font-semibold text-content-primary">{q}</span>
                  <button onClick={() => { searchParams.delete('q'); setSearchParams(searchParams); }} className="ml-2 text-primary hover:underline">Limpiar</button>
                </div>
              )}
              <form
                onSubmit={submitHeroSearch}
                role="search"
                className="flex h-12 w-full max-w-2xl items-center gap-3 rounded-pill border border-border bg-surface px-5 text-content-secondary transition-colors focus-within:shadow-elevation-1"
              >
                <button type="submit" aria-label="Buscar" className="shrink-0 focus-visible:outline-focus">
                  <Search size={20} />
                </button>
                  <input
                    type="search"
                    value={heroTerm}
                    onChange={(e) => setHeroTerm(e.target.value)}
                    placeholder={adapter.mode === 'assets' ? 'Buscar en Unidad compartida...' : 'Busca en tu unidad (ej. "factura")'}
                    className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none"
                  />
              </form>
              <SearchFilterBar 
                type={typeFilter} 
                date={dateFilter} 
                onChange={(key, val) => {
                  if (val) searchParams.set(key, val)
                  else searchParams.delete(key)
                  setSearchParams(searchParams)
                }} 
              />
              <div ref={heroSentinelRef} aria-hidden className="mt-4 h-px w-full" />
            </div>
          )}

          {atRoot && adapter.mode === 'drive' && assetsAccess?.allowed && (
            <button
              onClick={() => navigate('/assets')}
              className="group mb-4 flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left transition-colors hover:bg-surface-hover sm:max-w-xs"
            >
              <FolderSymlink size={22} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content-primary">Unidad compartida</p>
                <p className="truncate text-xs text-content-tertiary">Carpeta compartida de la organización</p>
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
          ) : (
            <AnimatePresence mode="wait">
              {view === 'list' ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FileListView items={items} selected={selected} onOpen={openItem} onSelectToggle={toggleSelect} onAction={onAction} interactions={interactions} ownerName={adapter.mode === 'assets' ? '-' : user?.display_name} capabilities={adapter.capabilities} />
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FileGridView items={items} selected={selected} onOpen={openItem} onSelectToggle={toggleSelect} onAction={onAction} interactions={interactions} capabilities={adapter.capabilities} />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {hasMore && (
            <div className="flex justify-center py-8">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore} loading={loadingMore}>
                Cargar más elementos
              </Button>
            </div>
          )}
        </div>
      </div>

      {marqueeOverlay}

      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.2 }}
            className="ml-4 hidden w-80 shrink-0 overflow-hidden rounded-drive border border-border lg:block"
          >
            <DetailsPanel items={selectedItems} onClose={() => setShowDetails(false)} />
          </motion.div>
        )}
      </AnimatePresence>

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
      {dialog?.kind === 'move' && (
        <MoveDialog
          open
          mode={dialog.mode}
          sourceMode={adapter.mode}
          items={dialog.items}
          onClose={() => setDialog(null)}
          onConfirm={moveOrCopy}
        />
      )}
      <DeleteDialog
        open={dialog?.kind === 'delete'}
        items={dialog?.kind === 'delete' ? dialog.items : []}
        onClose={() => setDialog(null)}
        onConfirm={() => runDelete(dialog?.kind === 'delete' ? dialog.items : [])}
      />
      <BlockActionsDialog
        item={dialog?.kind === 'block' ? dialog.item : null}
        onClose={() => setDialog(null)}
        onSuccess={() => reload()}
      />

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
                  ...(adapter.capabilities.canMove ? [{
                    id: 'move',
                    label: `Mover ${selectedItems.length} elementos`,
                    icon: FolderInput,
                    onSelect: () => setDialog({ kind: 'move', mode: 'move', items: selectedItems }),
                  }] : []),
                  ...(adapter.capabilities.canCopy ? [{
                    id: 'copy',
                    label: 'Copiar a',
                    icon: Copy,
                    onSelect: () => setDialog({ kind: 'move', mode: 'copy', items: selectedItems }),
                  }] : []),
                  ...(adapter.capabilities.canDelete ? [{
                    id: 'delete',
                    label: 'Enviar a la papelera',
                    icon: Trash2,
                    danger: true,
                    divider: true,
                    onSelect: () => setDialog({ kind: 'delete', items: selectedItems }),
                  }] : []),
                ]
                : buildItemMenu(ctxMenu.item, (a: ItemAction) => onAction(ctxMenu.item!, a), adapter.capabilities)
          }
        />
      )}
    </div>
  )
}
