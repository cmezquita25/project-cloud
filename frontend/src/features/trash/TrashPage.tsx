import { Trash2 } from 'lucide-react'
import { EmptyState } from '@shared/ui'

export function TrashPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Papelera</h1>
      <div className="flex-1">
        <EmptyState
          icon={Trash2}
          title="La papelera está vacía"
          description="Los elementos eliminados aparecerán aquí. Funcionalidad completa en la Fase 7."
        />
      </div>
    </div>
  )
}
