import { api } from '@shared/api'
import type { LinkInput, LinkTarget, LinkTargetInfo, ShareLink } from '../types'

const targetQuery = (t: LinkTarget): string => {
  const q = new URLSearchParams({ scope: t.scope, target_type: t.target_type })
  if (t.target_id !== undefined) q.set('target_id', String(t.target_id))
  if (t.target_path !== undefined) q.set('target_path', t.target_path)
  return q.toString()
}

/** Enlaces compartidos (lado del que comparte; requiere sesión). */
export const linksApi = {
  list: (t: LinkTarget) =>
    api.get<{ links: ShareLink[]; target: LinkTargetInfo }>(`/links?${targetQuery(t)}`),
  create: (t: LinkTarget, input: LinkInput) =>
    api.post<ShareLink>('/links', {
      scope: t.scope,
      target_type: t.target_type,
      target_id: t.target_id,
      target_path: t.target_path,
      ...input,
    }),
  update: (id: number, input: LinkInput) => api.patch<ShareLink>(`/links/${id}`, input),
  revoke: (id: number) => api.delete<ShareLink>(`/links/${id}`),
}
