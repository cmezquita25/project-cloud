import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@shared/api'
import { driveApi } from '../services/driveApi'
import type { FolderContents, FolderRef } from '../types'

interface State {
  data: FolderContents | null
  loading: boolean
  error: string | null
}

/** Carga el contenido de una carpeta y expone recarga. */
export function useFolderContents(folderId: FolderRef) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  const load = useCallback(
    (signal?: AbortSignal) => {
      setState((s) => ({ ...s, loading: true, error: null }))
      driveApi
        .contents(folderId, signal)
        .then((data) => setState({ data, loading: false, error: null }))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setState({
            data: null,
            loading: false,
            error: e instanceof ApiError ? e.message : 'No se pudo cargar la carpeta',
          })
        })
    },
    [folderId]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const reload = useCallback(() => load(), [load])

  return { ...state, reload }
}
