import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ExplorerLayout } from '../drive-explorer/components/ExplorerLayout'
import { useAssetsAdapter } from '../drive-explorer/adapters/useAssetsAdapter'
import { useAssetsAccess } from './hooks/useAssetsAccess'
import { SharedUnitSetupDialog } from './components/SharedUnitSetupDialog'
import { Button, EmptyState, Spinner } from '@shared/ui'
import { FolderPlus, ServerOff } from 'lucide-react'
import type { FolderRef } from '../drive-explorer/types'

export function AssetsPage() {
  const params = useParams()
  const path: FolderRef = params['*'] ? params['*'] : 'root'

  const { access, loading } = useAssetsAccess()
  const adapter = useAssetsAdapter()
  const [setupOpen, setSetupOpen] = useState(false)

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

  // La carpeta configurada no existe (instalación nueva o se borró del servidor).
  if (!access.active) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={FolderPlus}
          title="La unidad compartida aún no existe"
          description={
            access.is_admin
              ? 'Créala para que tu equipo tenga un espacio común donde subir y compartir los archivos de la organización.'
              : 'Un administrador debe crearla antes de que puedas usarla.'
          }
          action={
            access.is_admin ? (
              <Button leftIcon={FolderPlus} onClick={() => setSetupOpen(true)}>
                Crear unidad compartida
              </Button>
            ) : undefined
          }
        />
        {access.is_admin && <SharedUnitSetupDialog open={setupOpen} onClose={() => setSetupOpen(false)} />}
      </div>
    )
  }

  // Assets uses the same layout but with heroSearch=true on root
  return <ExplorerLayout folderId={path} adapter={adapter} heroSearch={true} />
}
