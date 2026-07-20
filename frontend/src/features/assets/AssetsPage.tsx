import { useParams } from 'react-router-dom'
import { ExplorerLayout } from '../drive-explorer/components/ExplorerLayout'
import { useAssetsAdapter } from '../drive-explorer/adapters/useAssetsAdapter'
import { useAssetsAccess } from './hooks/useAssetsAccess'
import { EmptyState, Spinner } from '@shared/ui'
import { ServerOff } from 'lucide-react'
import type { FolderRef } from '../drive-explorer/types'

export function AssetsPage() {
  const params = useParams()
  const path: FolderRef = params['*'] ? params['*'] : 'root'
  
  const { access, loading } = useAssetsAccess()
  const adapter = useAssetsAdapter()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={32} className="text-content-tertiary" />
      </div>
    )
  }

  if (!access?.allowed) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={ServerOff}
          title="Acceso denegado"
          description="No tienes permiso para acceder a la unidad compartida."
        />
      </div>
    )
  }

  // Assets uses the same layout but with heroSearch=true on root
  return <ExplorerLayout folderId={path} adapter={adapter} heroSearch={true} />
}
