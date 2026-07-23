import { useCallback, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { FolderContents, FolderRef } from '../types'
import type { SortState } from '../components/SortControl'
import type { IExplorerAdapter } from '../adapters/types'

export function useFolderContents(
  folderId: FolderRef, 
  sortState: SortState, 
  adapter: IExplorerAdapter, 
  q?: string, 
  type?: string, 
  date?: string
) {
  const limit = 10

  const {
    data: infiniteData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error
  } = useInfiniteQuery({
    queryKey: ['explorer', adapter.cacheKey, folderId, sortState.field, sortState.dir, q, type, date],
    queryFn: ({ pageParam = 0, signal }) => {
      return adapter.loadContents(folderId, sortState, signal, pageParam as number, limit, q, type, date)
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.has_more) {
        return allPages.length * limit
      }
      return undefined
    },
    initialPageParam: 0,
    staleTime: 60 * 1000, // 1 minuto de caché viva
  })

  // Aplanar las páginas devueltas por React Query para simular la estructura original
  const flatData = useMemo<FolderContents | null>(() => {
    if (!infiniteData || !infiniteData.pages || infiniteData.pages.length === 0) return null
    const firstPage = infiniteData.pages[0]
    if (!firstPage) return null
    return {
      folder: firstPage.folder || null,
      breadcrumbs: firstPage.breadcrumbs || [],
      folders: infiniteData.pages.flatMap(p => p.folders),
      files: infiniteData.pages.flatMap(p => p.files),
      has_more: hasNextPage
    }
  }, [infiniteData, hasNextPage])

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const reload = useCallback(() => {
    refetch()
  }, [refetch])

  return {
    data: flatData,
    loading: isLoading, // Solo es true si NO hay caché en absoluto
    error: error ? error.message : null,
    loadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    reload,
    loadMore
  }
}
