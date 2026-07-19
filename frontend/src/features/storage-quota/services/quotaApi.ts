import { api } from '@shared/api'

export type FileKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'code'
  | 'design'
  | 'executable'
  | 'other'

export interface QuotaBreakdown {
  kind: FileKind
  bytes: number
  count: number
}

export interface QuotaUsage {
  used_bytes: number
  quota_bytes: number
  max_upload_bytes: number
  percent: number
  breakdown: QuotaBreakdown[]
}

export const quotaApi = {
  get: (signal?: AbortSignal) => api.get<QuotaUsage>('/quota', { signal }),
}
