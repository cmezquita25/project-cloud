import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trash2, RotateCcw, Trash, MoreVertical, X } from 'lucide-react'
import { ApiError } from '@shared/api'
import { Button, EmptyState, Spinner, IconButton, Dialog, useToast, Menu, type MenuItem } from '@shared/ui'
import { useDisclosure } from '@shared/hooks/useDisclosure'
import { cn } from '@shared/lib/cn'
import { getFileIcon } from '@shared/lib/fileIcons'
import { formatBytes } from '@shared/lib/formatBytes'
import { formatRelative } from '@shared/lib/formatDate'
import { useMarqueeSelection } from '@features/drive-explorer/hooks/useMarqueeSelection'
import { trashApi } from './services/trashApi'
import type { DriveItem } from '@features/drive-explorer/types'

const key = (i: DriveItem) => `${i.type}-${i.id}`

export function TrashPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['library', 'trash'],
    queryFn: ({ signal }) => trashApi.list(signal),
  })

  const items = useMemo(() => {
    if (!data) return []
    return [...data.folders, ...data.files]
  }, [data])
  const retentionDays = data?.retention_days ?? 30
  
  const errorMessage = error instanceof ApiError ? error.message : (error ? 'No se pudo cargar la papelera' : null)


  // Selección (clic + lazo).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const selectedItems = useMemo(() => items.filter((i) => selected.has(key(i))), [items, selected])
  const clearSelection = () => setSelected(new Set())

  // Diálogos de confirmación.
  const [purgeTargets, setPurgeTargets] = useState<DriveItem[]>([])
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const marqueeBase = useRef<Set<string>>(new Set())
  const { overlay: marqueeOverlay } = useMarqueeSelection({
    containerRef: scrollRef,
    onBegin: (additive) => {
      marqueeBase.current = additive ? new Set(selected) : new Set()
      if (!additive) setSelected(new Set())
    },
    onSelect: (keys) => setSelected(new Set([...marqueeBase.current, ...keys])),
  })

  const removeOptimistic = (targetKeys: Set<string>) => {
    queryClient.setQueryData(['library', 'trash'], (old: any) => {
      if (!old) return old
      return {
        ...old,
        folders: old.folders.filter((i: any) => !targetKeys.has(key(i))),
        files: old.files.filter((i: any) => !targetKeys.has(key(i))),
      }
    })
  }

  const onRowClick = (item: DriveItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        const k = key(item)
        next.has(k) ? next.delete(k) : next.add(k)
        return next
      })
    } else {
      setSelected(new Set([key(item)]))
    }
  }

  const restore = async (item: DriveItem) => {
    setBusy(key(item))
    try {
      await (item.type === 'folder' ? trashApi.restoreFolder(item.id) : trashApi.restoreFile(item.id))
      removeOptimistic(new Set([key(item)]))
      toast.success('Restaurado')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo restaurar')
    } finally {
      setBusy(null)
    }
  }

  const bulkRestore = async () => {
    const targets = selectedItems
    if (targets.length === 0) return
    setSubmitting(true)
    try {
      for (const item of targets) {
        await (item.type === 'folder' ? trashApi.restoreFolder(item.id) : trashApi.restoreFile(item.id))
      }
      const done = new Set(targets.map(key))
      removeOptimistic(done)
      clearSelection()
      toast.success(targets.length === 1 ? 'Restaurado' : `${targets.length} elementos restaurados`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo restaurar')
      refetch()
    } finally {
      setSubmitting(false)
    }
  }

  const purge = async () => {
    const targets = purgeTargets
    if (targets.length === 0) return
    setSubmitting(true)
    try {
      for (const item of targets) {
        await (item.type === 'folder' ? trashApi.purgeFolder(item.id) : trashApi.purgeFile(item.id))
      }
      const done = new Set(targets.map(key))
      removeOptimistic(done)
      setSelected((prev) => {
        const next = new Set(prev)
        done.forEach((k) => next.delete(k))
        return next
      })
      toast.success(targets.length === 1 ? 'Eliminado definitivamente' : `${targets.length} elementos eliminados`)
      setPurgeTargets([])
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar')
      refetch()
    } finally {
      setSubmitting(false)
    }
  }

  const emptyTrash = async () => {
    setSubmitting(true)
    try {
      await trashApi.empty()
      removeOptimistic(new Set(items.map(key)))
      clearSelection()
      toast.success('Papelera vaciada')
      setConfirmEmpty(false)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo vaciar la papelera')
    } finally {
      setSubmitting(false)
    }
  }

  const isEmpty = !isLoading && !errorMessage && items.length === 0

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      {/* Cabecera con altura fija: sin salto al seleccionar. */}
      <div className="mb-2 flex h-9 items-center justify-between gap-3">
        {selected.size > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <IconButton icon={X} label="Deseleccionar" size="sm" onClick={clearSelection} />
            <span className="whitespace-nowrap text-sm font-medium text-primary">
              {selected.size} seleccionado(s)
            </span>
            <div className="flex items-center gap-1">
              <IconButton icon={RotateCcw} label="Restaurar" size="sm" onClick={bulkRestore} />
              <IconButton icon={Trash2} label="Eliminar definitivamente" size="sm" onClick={() => setPurgeTargets(selectedItems)} />
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-normal text-content-primary">Papelera</h1>
        )}
        {items.length > 0 && selected.size === 0 && (
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

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-content-tertiary">
            <Spinner size={32} />
          </div>
        ) : errorMessage ? (
          <div className="rounded-drive border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
            {errorMessage}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Trash2}
            title="La papelera está vacía"
            description="Los archivos y carpetas que elimines aparecerán aquí y podrás restaurarlos."
          />
        ) : (
          <div className="overflow-hidden rounded-drive border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-content-tertiary">
                  <th className="w-full py-3 pl-4 pr-4 font-medium">Nombre</th>
                  <th className="hidden w-40 whitespace-nowrap px-4 py-3 font-medium sm:table-cell">Eliminado</th>
                  <th className="hidden w-28 whitespace-nowrap px-4 py-3 font-medium md:table-cell">Tamaño</th>
                  <th className="w-24 py-3 pl-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <TrashRow
                    key={key(item)}
                    item={item}
                    busy={busy === key(item)}
                    selected={selected.has(key(item))}
                    onClick={(e) => onRowClick(item, e)}
                    onRestore={() => restore(item)}
                    onPurge={() => setPurgeTargets([item])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rectángulo de selección por área */}
      {marqueeOverlay}

      {/* Confirmar borrado definitivo (uno o varios) */}
      <Dialog
        open={purgeTargets.length > 0}
        onClose={() => (submitting ? undefined : setPurgeTargets([]))}
        title="Eliminar definitivamente"
        description={
          purgeTargets.length === 1
            ? `"${purgeTargets[0]?.name}" se eliminará para siempre. Esta acción no se puede deshacer.`
            : `${purgeTargets.length} elementos se eliminarán para siempre. Esta acción no se puede deshacer.`
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurgeTargets([])} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="danger" loading={submitting} onClick={purge}>
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
    </motion.div>
  )
}

interface TrashRowProps {
  item: DriveItem
  busy: boolean
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onRestore: () => void
  onPurge: () => void
}

function TrashRow({ item, busy, selected, onClick, onRestore, onPurge }: TrashRowProps) {
  const { icon: Icon, className } = getFileIcon(item.name, item.type === 'folder')
  const menu = useDisclosure()
  const anchor = useRef<HTMLDivElement>(null)

  const menuItems: MenuItem[] = [
    { id: 'restore', label: 'Restaurar', icon: RotateCcw, onSelect: onRestore },
    { id: 'purge', label: 'Eliminar definitivamente', icon: Trash2, onSelect: onPurge, danger: true, divider: true },
  ]

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      data-sel-key={key(item)}
      onClick={onClick}
      className={cn(
        'group cursor-pointer border-b border-border/60 last:border-0 transition-colors',
        selected ? 'bg-primary-subtle' : 'hover:bg-surface-hover'
      )}
    >
      <td className="w-full max-w-0 py-3 pl-4 pr-4">
        <div className="flex min-w-[200px] items-center gap-3">
          <Icon size={20} className={cn('shrink-0', className)} />
          <span className="truncate font-medium text-content-primary">{item.name}</span>
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-content-secondary sm:table-cell">
        {item.deleted_at ? formatRelative(item.deleted_at) : '—'}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-content-secondary md:table-cell">
        {item.type === 'file' ? formatBytes(item.size_bytes) : '—'}
      </td>
      <td className="py-3 pl-2 pr-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {busy ? (
            <Spinner size={18} className="text-content-tertiary" />
          ) : (
            <IconButton icon={RotateCcw} label="Restaurar" size="sm" onClick={onRestore} />
          )}
          <div ref={anchor} className="relative">
            <IconButton
              icon={MoreVertical}
              label="Más acciones"
              size="sm"
              active={menu.isOpen}
              onClick={menu.toggle}
            />
            <Menu
              open={menu.isOpen}
              onClose={menu.close}
              items={menuItems}
              title={item.name}
              align="right"
              anchorRef={anchor}
            />
          </div>
        </div>
      </td>
    </motion.tr>
  )
}
