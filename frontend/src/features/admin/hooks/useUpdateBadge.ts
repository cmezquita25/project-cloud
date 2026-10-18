import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/AuthProvider'
import { updatesApi } from '../services/updatesApi'

export const UPDATE_BADGE_KEY = ['admin', 'updates-badge'] as const

/**
 * Versión disponible para el aviso del sidebar, la pestaña de Configuración y
 * el dashboard. Solo consulta si el usuario es administrador. El servidor, de
 * paso, busca versiones si la última consulta tiene más de 12 h.
 */
export function useUpdateBadge(): string | null {
  const { isAdmin } = useAuth()
  const { data } = useQuery({
    queryKey: UPDATE_BADGE_KEY,
    queryFn: updatesApi.badge,
    enabled: isAdmin,
    staleTime: 30 * 60_000,
    retry: false,
  })
  return isAdmin ? data?.available_version ?? null : null
}
