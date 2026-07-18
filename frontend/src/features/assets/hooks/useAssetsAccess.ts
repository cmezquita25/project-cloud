import { useEffect, useState } from 'react'
import { assetsApi, type AssetsAccess } from '../services/assetsApi'

interface State {
  access: AssetsAccess | null
  loading: boolean
}

/** Consulta si el usuario actual puede ver/interactuar con la unidad "assets". */
export function useAssetsAccess() {
  const [state, setState] = useState<State>({ access: null, loading: true })

  useEffect(() => {
    const c = new AbortController()
    assetsApi
      .access(c.signal)
      .then((access) => setState({ access, loading: false }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setState({ access: { allowed: false, is_admin: false, can_write: false }, loading: false })
      })
    return () => c.abort()
  }, [])

  return state
}
