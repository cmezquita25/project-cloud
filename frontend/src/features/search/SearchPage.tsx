import { Search } from 'lucide-react'
import { EmptyState } from '@shared/ui'

export function SearchPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Resultados de búsqueda</h1>
      <div className="flex-1">
        <EmptyState
          icon={Search}
          title="Busca en tu unidad"
          description="Escribe en la barra superior para encontrar archivos y carpetas. Disponible en la Fase 7."
        />
      </div>
    </div>
  )
}
