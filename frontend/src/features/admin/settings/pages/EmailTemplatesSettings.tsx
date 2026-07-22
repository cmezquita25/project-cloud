import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Edit2 } from 'lucide-react'
import { Spinner } from '@shared/ui'
import { adminApi } from '../../services/adminApi'


export function EmailTemplatesSettings() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: () => adminApi.getEmailTemplates()
  })

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-content-tertiary">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Plantillas de correo</h2>
        <p className="text-sm text-content-secondary">
          Personaliza el diseño y el contenido de los correos automáticos que envía la plataforma.
        </p>
      </div>

      <div className="rounded-drive border border-border bg-surface overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container/50 text-content-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre de la plantilla</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {templates.map((t) => (
              <tr key={t.key} className="hover:bg-surface-hover/50 transition-colors">
                <td className="px-4 py-3 font-medium text-content-primary">{t.label}</td>
                <td className="px-4 py-3 text-content-secondary">{t.description}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/admin/settings/email-templates/${t.key}`}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-subtle transition-colors"
                  >
                    <Edit2 size={14} />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-content-tertiary">
                  No hay plantillas disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
