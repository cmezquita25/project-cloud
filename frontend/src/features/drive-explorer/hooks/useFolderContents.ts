import { useCallback, useEffect, useState, useRef } from 'react'
import { ApiError } from '@shared/api'
import type { FolderContents, FolderRef } from '../types'
import type { SortState } from '../components/SortControl'
import type { IExplorerAdapter } from '../adapters/types'

interface State {
  data: FolderContents | null
  loading: boolean
  error: string | null
  loadingMore: boolean
  hasMore: boolean
}

/** Carga el contenido de una carpeta utilizando el adaptador especificado. */
export function useFolderContents(folderId: FolderRef, sortState: SortState, adapter: IExplorerAdapter, q?: string, type?: string, date?: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, loadingMore: false, hasMore: false })
  const offsetRef = useRef(0)
  const limit = 10

  const load = useCallback(
    (signal?: AbortSignal, isLoadMore = false) => {
      setState((s) => ({ ...s, [isLoadMore ? 'loadingMore' : 'loading']: true, error: null }))
      
      const currentOffset = isLoadMore ? offsetRef.current : 0
      
      adapter.loadContents(folderId, sortState, signal, currentOffset, limit, q, type, date)
        .then((res) => {
          offsetRef.current = currentOffset + limit
          setState((s) => {
            if (isLoadMore && s.data) {
              return {
                data: {
                  ...res,
                  folders: [...s.data.folders, ...res.folders],
                  files: [...s.data.files, ...res.files],
                },
                loading: false,
                loadingMore: false,
                error: null,
                hasMore: res.has_more ?? false,
              }
            }
            return { 
              data: res, 
              loading: false, 
              loadingMore: false,
              error: null,
              hasMore: res.has_more ?? false
            }
          })
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setState((s) => ({
            ...s,
            [isLoadMore ? 'loadingMore' : 'loading']: false,
            error: e instanceof ApiError ? e.message : 'No se pudo cargar la carpeta',
          }))
        })
    },
    [folderId, sortState.field, sortState.dir, q, type, date]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal, false)
    return () => controller.abort()
  }, [load])

  const reload = useCallback(() => load(undefined, false), [load])
  const loadMore = useCallback(() => {
    if (!state.loadingMore && state.hasMore) {
      load(undefined, true)
    }
  }, [load, state.loadingMore, state.hasMore])

  return { ...state, reload, loadMore }
}
