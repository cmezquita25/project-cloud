import { useParams } from 'react-router-dom'
import { ExplorerLayout } from './components/ExplorerLayout'
import { useDriveAdapter } from './adapters/useDriveAdapter'
import type { FolderRef } from './types'

export function DriveExplorerPage() {
  const params = useParams()
  const folderId: FolderRef = params.folderId ? Number(params.folderId) : 'root'
  const adapter = useDriveAdapter()

  return <ExplorerLayout folderId={folderId} adapter={adapter} heroSearch={true} />
}
