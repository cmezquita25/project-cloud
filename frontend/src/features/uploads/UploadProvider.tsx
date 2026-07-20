import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '@shared/api'
import { driveApi } from '@features/drive-explorer/services/driveApi'
import { authApi } from '@features/auth/services/authApi'
import { uploadApi } from './services/uploadApi'
import { assetsApi } from '@features/assets/services/assetsApi'
import type { FolderRef } from '@features/drive-explorer/types'

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled'

export interface UploadTask {
  id: string
  name: string
  size: number
  loaded: number
  status: UploadStatus
  error?: string
  folderId: FolderRef
  relativeDir: string // subruta de carpeta (para subir carpetas), '' si raíz del destino
  file: File
  mode?: 'drive' | 'assets'
}

interface UploadContextValue {
  tasks: UploadTask[]
  enqueue: (files: File[], folderId: FolderRef, mode?: 'drive' | 'assets') => void
  cancel: (id: string) => void
  retry: (id: string) => void
  clearFinished: () => void
  dismissAll: () => void
  /** Se incrementa al completar; incluye la carpeta afectada (para recargar). */
  completion: { tick: number; folderIds: Set<string> }
}

const UploadContext = createContext<UploadContextValue | null>(null)

let seq = 0
const nextId = () => `u${++seq}-${Date.now()}`

export function UploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [completion, setCompletion] = useState({ tick: 0, folderIds: new Set<string>() })

  const processingRef = useRef(false)
  const abortRef = useRef(new Map<string, AbortController>())
  // Cache de carpetas creadas para subida de carpetas: `${base}//${relDir}` -> folderId real.
  const folderCacheRef = useRef(new Map<string, FolderRef>())

  const patch = useCallback((id: string, changes: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)))
  }, [])

  const refreshQuota = useCallback(() => {
    authApi
      .me()
      .then(() => { /* user updated via react-query or context elsewhere if needed, or simply ignored if quota update is enough */ })
      .catch(() => undefined)
  }, [])

  // Resuelve (creando si hace falta) la carpeta destino para una subruta.
  const resolveFolder = useCallback(async (base: FolderRef, relDir: string): Promise<FolderRef> => {
    if (relDir === '') return base
    const parts = relDir.split('/').filter(Boolean)
    let parent = base
    let acc = ''
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      const cacheKey = `${base}//${acc}`
      const cached = folderCacheRef.current.get(cacheKey)
      if (cached !== undefined) {
        parent = cached
        continue
      }
      let folderId: FolderRef
      try {
        const created = await driveApi.createFolder(parent, part)
        folderId = created.id
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NAME_EXISTS') {
          // Ya existe: buscar su id en el contenido del padre.
          const contents = await driveApi.contents(parent)
          const found = contents.folders.find((f) => f.name === part)
          if (!found) throw e
          folderId = found.id
        } else {
          throw e
        }
      }
      folderCacheRef.current.set(cacheKey, folderId)
      parent = folderId
    }
    return parent
  }, [])

  const uploadTask = useCallback(
    async (task: UploadTask) => {
      const controller = new AbortController()
      abortRef.current.set(task.id, controller)
      patch(task.id, { status: 'uploading', loaded: 0, error: undefined })

      try {
        if (task.mode === 'assets') {
          const basePath = task.folderId === 'root' ? '' : String(task.folderId)
          let targetPath = task.relativeDir ? `${basePath}/${task.relativeDir}` : basePath
          targetPath = targetPath.replace(/^\/+/, '').replace(/\/+/g, '/') // clean slashes
          
          if (controller.signal.aborted) throw new DOMException('abort', 'AbortError')
          await assetsApi.upload(targetPath, task.file)
          patch(task.id, { status: 'done', loaded: task.size })
          setCompletion((c) => ({
            tick: c.tick + 1,
            folderIds: new Set(c.folderIds).add(String(task.folderId)),
          }))
          return
        }

        const targetFolder = await resolveFolder(task.folderId, task.relativeDir)

        const init = await uploadApi.init({
          folder_id: targetFolder,
          name: task.name,
          size: task.size,
          mime: task.file.type || null,
        })

        let offset = init.offset
        const chunkSize = init.chunk_size
        // Archivo vacío: no hay chunks que enviar.
        while (offset < task.size) {
          if (controller.signal.aborted) throw new DOMException('abort', 'AbortError')
          const end = Math.min(offset + chunkSize, task.size)
          const blob = task.file.slice(offset, end)
          const res = await uploadApi.chunk(init.upload_id, offset, blob, controller.signal)
          offset = res.offset
          patch(task.id, { loaded: offset })
        }

        await uploadApi.complete(init.upload_id)
        patch(task.id, { status: 'done', loaded: task.size })
        // Notifica para recargar la carpeta y refrescar la cuota.
        setCompletion((c) => ({
          tick: c.tick + 1,
          folderIds: new Set(c.folderIds).add(String(targetFolder)),
        }))
        refreshQuota()
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          patch(task.id, { status: 'canceled' })
        } else {
          patch(task.id, { status: 'error', error: e instanceof ApiError ? e.message : 'Error al subir' })
        }
      } finally {
        abortRef.current.delete(task.id)
      }
    },
    [patch, resolveFolder, refreshQuota]
  )

  // Procesador secuencial de la cola.
  const pump = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = await new Promise<UploadTask | null>((resolve) => {
          setTasks((prev) => {
            resolve(prev.find((t) => t.status === 'queued') ?? null)
            return prev
          })
        })
        if (!next) break
        await uploadTask(next)
      }
    } finally {
      processingRef.current = false
      folderCacheRef.current.clear()
    }
  }, [uploadTask])

  const enqueue = useCallback((files: File[], folderId: FolderRef, mode: 'drive' | 'assets' = 'drive') => {
    setTasks((prev) => [
      ...prev,
      ...files.map((file) => {
        const relativePath = (file as any).webkitRelativePath || file.name
        const parts = relativePath.split('/')
        const relativeDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
        return {
          id: nextId(),
          name: file.name,
          size: file.size,
          loaded: 0,
          status: 'queued' as UploadStatus,
          folderId,
          relativeDir,
          file,
          mode,
        }
      }),
    ])
    void pump()
  }, [pump])

  const cancel = useCallback((id: string) => {
    abortRef.current.get(id)?.abort()
    setTasks((prev) =>
      prev.map((t) => (t.id === id && t.status === 'queued' ? { ...t, status: 'canceled' } : t))
    )
  }, [])

  const retry = useCallback(
    (id: string) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'queued', error: undefined } : t)))
      void pump()
    },
    [pump]
  )

  const clearFinished = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === 'uploading' || t.status === 'queued'))
  }, [])

  const dismissAll = useCallback(() => {
    abortRef.current.forEach((c) => c.abort())
    setTasks([])
  }, [])

  const value = useMemo<UploadContextValue>(
    () => ({ tasks, enqueue, cancel, retry, clearFinished, dismissAll, completion }),
    [tasks, enqueue, cancel, retry, clearFinished, dismissAll, completion]
  )

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUploads debe usarse dentro de <UploadProvider>')
  return ctx
}
