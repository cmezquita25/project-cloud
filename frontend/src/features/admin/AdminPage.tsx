import { Shield } from 'lucide-react'
import { EmptyState } from '@shared/ui'

export function AdminPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Administración</h1>
      <div className="flex-1">
        <EmptyState
          icon={Shield}
          title="Panel de administración"
          description="Gestión de usuarios, cuotas y actividad. Se construye en la Fase 6."
        />
      </div>
    </div>
  )
}
