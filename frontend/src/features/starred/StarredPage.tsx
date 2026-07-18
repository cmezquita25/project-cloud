import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { ApiError } from '@shared/api'
import { libraryApi } from '@features/library/services/libraryApi'
import { ItemCollection } from '@features/library/components/ItemCollection'
import type { DriveItem } from '@features/drive-explorer/types'

export function StarredPage() {
  const [items, setItems] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    libraryApi
      .starred(signal)
      .then((r) => {
        setItems([...r.folders, ...r.files])
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los destacados')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const c = new AbortController()
    load(c.signal)
    return () => c.abort()
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Destacados</h1>
      <div className="min-h-0 flex-1">
        <ItemCollection
          items={items}
          loading={loading}
          error={error}
          reload={() => load()}
          empty={{
            icon: Star,
            title: 'No tienes elementos destacados',
            description: 'Marca archivos y carpetas con la estrella para encontrarlos rápido aquí.',
          }}
        />
      </div>
    </div>
  )
}
