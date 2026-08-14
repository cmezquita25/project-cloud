import { useState, useEffect, useCallback } from 'react'
import { api } from '@shared/api'

export interface SharedUnit {
  share_id: number
  owner_id: number
  owner_name: string
  owner_email: string
  permission_level: 'read' | 'full'
  name: string
}

export interface SharedFolder {
  id: number
  name: string
  parent_id: number | null
  owner_id: number
  owner_name: string
  permission_level: 'read' | 'full'
  created_at: string | null
  updated_at: string | null
}

export interface SharedFile {
  id: number
  name: string
  folder_id: number | null
  parent_folder_name: string | null
  size_bytes: number
  mime_type: string | null
  extension: string | null
  owner_id: number
  owner_name: string
  permission_level: 'read' | 'full'
  created_at: string | null
  updated_at: string | null
}

export interface SharedItemsData {
  units: SharedUnit[]
  folders: SharedFolder[]
  files: SharedFile[]
}

export function useSharedItems() {
  const [data, setData] = useState<SharedItemsData>({ units: [], folders: [], files: [] })
  const [loading, setLoading] = useState(false)

  const fetchShared = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<SharedItemsData>('/shares/shared-with-me')
      setData({
        units: res.units || [],
        folders: res.folders || [],
        files: res.files || [],
      })
    } catch (err) {
      // Silencioso en caso de error o sin sesión
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShared()
    
    // Escuchar eventos globales de cambio en compartidos
    const handler = () => fetchShared()
    window.addEventListener('pc:shared-changed', handler)
    return () => window.removeEventListener('pc:shared-changed', handler)
  }, [fetchShared])

  return { ...data, loading, refetch: fetchShared }
}
