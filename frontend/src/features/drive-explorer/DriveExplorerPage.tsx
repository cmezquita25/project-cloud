import { useState } from 'react'
import { UploadCloud, FolderPlus } from 'lucide-react'
import { Button, EmptyState } from '@shared/ui'
import { ViewToggle, type ViewMode } from './components/ViewToggle'

/**
 * Página "Mi unidad" — raíz del explorador de archivos.
 * En Fase 4 se conecta a la API y se renderiza el contenido real de carpetas.
 */
export function DriveExplorerPage() {
  const [view, setView] = useState<ViewMode>('list')

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-normal text-content-primary">Mi unidad</h1>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="flex-1 rounded-drive border border-dashed border-border">
        <EmptyState
          icon={UploadCloud}
          title="Arrastra tus archivos aquí"
          description="O usa el botón «Nuevo» para subir archivos y crear carpetas. El explorador completo llega en la Fase 4."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button leftIcon={UploadCloud}>Subir archivos</Button>
              <Button variant="secondary" leftIcon={FolderPlus}>
                Nueva carpeta
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
