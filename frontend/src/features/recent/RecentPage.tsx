import { useCallback, useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { ApiError } from '@shared/api'
import { libraryApi } from '@features/library/services/libraryApi'
import { ItemCollection } from '@features/library/components/ItemCollection'
import type { DriveItem } from '@features/drive-explorer/types'

export function RecentPage() {
  const [items, setItems] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    libraryApi
      .recent(signal)
      .then((r) => {
        setItems(r.files)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof ApiError ? e.message : 'No se pudo cargar recientes')
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
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Recientes</h1>
      <div className="min-h-0 flex-1">
        <ItemCollection
          items={items}
          loading={loading}
          error={error}
          reload={() => load()}
          empty={{
            icon: Clock,
            title: 'Sin actividad reciente',
            description: 'Aquí verás los archivos que subiste o modificaste recientemente.',
          }}
        />
      </div>
    </div>
  )
}
