import { Star } from 'lucide-react'
import { EmptyState } from '@shared/ui'

export function StarredPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Destacados</h1>
      <div className="flex-1">
        <EmptyState
          icon={Star}
          title="Aún no tienes destacados"
          description="Marca archivos y carpetas con la estrella para verlos aquí. Disponible en la Fase 7."
        />
      </div>
    </div>
  )
}
