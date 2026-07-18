import { useEffect, useState } from 'react'
import { quotaApi, type QuotaUsage } from '../services/quotaApi'

/** Carga el uso de almacenamiento del usuario. Se recarga con `deps`. */
export function useQuota(deps: unknown[] = []) {
  const [data, setData] = useState<QuotaUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    quotaApi
      .get(controller.signal)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading }
}
