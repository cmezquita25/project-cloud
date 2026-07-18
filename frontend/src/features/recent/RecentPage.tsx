import { Clock } from 'lucide-react'
import { EmptyState } from '@shared/ui'

export function RecentPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Recientes</h1>
      <div className="flex-1">
        <EmptyState
          icon={Clock}
          title="Sin actividad reciente"
          description="Aquí verás los archivos que abriste o modificaste recientemente. Disponible en la Fase 7."
        />
      </div>
    </div>
  )
}
