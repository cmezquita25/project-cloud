import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import { ApiError } from '@shared/api'
import { EmptyState } from '@shared/ui'
import { libraryApi } from '@features/library/services/libraryApi'
import { ItemCollection } from '@features/library/components/ItemCollection'
import { SearchFilterBar } from './components/SearchFilterBar'
import type { DriveItem } from '@features/drive-explorer/types'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const typeFilter = params.get('type') ?? ''
  const dateFilter = params.get('date') ?? ''

  const [items, setItems] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (query === '') {
        setItems([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      libraryApi
        .search(query, { type: typeFilter, date: dateFilter }, signal)
        .then((r) => {
          setItems([...r.folders, ...r.files])
          setLoading(false)
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setError(e instanceof ApiError ? e.message : 'No se pudo completar la búsqueda')
          setLoading(false)
        })
    },
    [query, typeFilter, dateFilter]
  )

  useEffect(() => {
    const c = new AbortController()
    load(c.signal)
    return () => c.abort()
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-1 text-2xl font-normal text-content-primary">Resultados de búsqueda</h1>
      {query !== '' && (
        <p className="text-sm text-content-tertiary">
          Para «<span className="text-content-secondary">{query}</span>»
        </p>
      )}

      {query !== '' && (
        <div className="mb-4">
          <SearchFilterBar 
            type={typeFilter} 
            date={dateFilter} 
            onChange={(key, val) => {
              if (val) params.set(key, val)
              else params.delete(key)
              setParams(params)
            }} 
          />
        </div>
      )}

      <div className="min-h-0 flex-1">
        {query === '' ? (
          <EmptyState
            icon={Search}
            title="Busca en tu unidad"
            description="Escribe en la barra superior para encontrar archivos y carpetas por su nombre."
          />
        ) : (
          <ItemCollection
            items={items}
            loading={loading}
            error={error}
            reload={() => load()}
            empty={{
              icon: SearchX,
              title: 'Sin resultados',
              description: `No se encontraron archivos ni carpetas que coincidan con «${query}».`,
            }}
          />
        )}
      </div>
    </div>
  )
}
