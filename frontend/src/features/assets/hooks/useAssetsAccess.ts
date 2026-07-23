import { useQuery } from '@tanstack/react-query'
import { assetsApi, type AssetsAccess } from '../services/assetsApi'

/** Consulta si el usuario actual puede ver/interactuar con la unidad "assets". */
export function useAssetsAccess() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['assets', 'access'],
    queryFn: ({ signal }) => assetsApi.access(signal),
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: false,
  })

  const fallback: AssetsAccess = { allowed: false, is_admin: false, can_write: false, active: false, folder_name: '' }

  return {
    access: isError ? fallback : (data ?? null),
    loading: isLoading,
  }
}
