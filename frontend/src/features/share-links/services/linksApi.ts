import { api } from '@shared/api'
import type { LinkHit, LinkInput, LinkPolicy, LinksPage, LinkTarget, LinkTargetInfo, PanelStatus, ShareLink } from '../types'

const targetQuery = (t: LinkTarget): string => {
  const q = new URLSearchParams({ scope: t.scope, target_type: t.target_type })
  if (t.target_id !== undefined) q.set('target_id', String(t.target_id))
  if (t.target_path !== undefined) q.set('target_path', t.target_path)
  return q.toString()
}

/** Enlaces compartidos (lado del que comparte; requiere sesión). */
export const linksApi = {
  list: (t: LinkTarget) =>
    api.get<{ links: ShareLink[]; target: LinkTargetInfo; policy: LinkPolicy }>(`/links?${targetQuery(t)}`),
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
  hits: (id: number) => api.get<{ hits: LinkHit[] }>(`/links/${id}/hits`),

  /** Panel: los míos (`mine`) o todos los de la instancia (`admin`). */
  panel: (mode: 'mine' | 'admin', q: { status: PanelStatus; q?: string; user_id?: number; page: number; limit: number }) => {
    const params = new URLSearchParams({ status: q.status, page: String(q.page), limit: String(q.limit) })
    if (q.q) params.set('q', q.q)
    if (q.user_id) params.set('user_id', String(q.user_id))
    return api.get<LinksPage>(`${mode === 'admin' ? '/admin/links' : '/links/mine'}?${params.toString()}`)
  },
  /** Revoca los seleccionados, o todos (exige escribir REVOCAR). */
  revokeMany: (mode: 'mine' | 'admin', body: { ids: number[] } | { all: true; confirm: string }) =>
    api.post<{ revoked: number }>(mode === 'admin' ? '/admin/links/revoke' : '/links/revoke', body),

  policy: () => api.get<LinkPolicy>('/admin/links/policy'),
  savePolicy: (p: Partial<LinkPolicy>) => api.put<LinkPolicy>('/admin/links/policy', p),
}
