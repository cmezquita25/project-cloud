import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { Button, Spinner } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { ApiError } from '@shared/api'
import { installApi } from '../services/installApi'
import type { RequirementsResult } from '../types'

interface StepRequirementsProps {
  onNext: () => void
}

/** Paso 1: verifica requisitos del servidor (PHP, extensiones, permisos). */
export function StepRequirements({ onNext }: StepRequirementsProps) {
  const [result, setResult] = useState<RequirementsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    installApi
      .check()
      .then(setResult)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error al verificar'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div>
      <h2 className="text-xl font-medium text-content-primary">Requisitos del servidor</h2>
      <p className="mt-1 text-sm text-content-secondary">
        Comprobamos que tu hosting cumple lo necesario para ejecutar Project Cloud.
      </p>

      <div className="mt-6 min-h-[200px]">
        {loading && (
          <div className="flex items-center justify-center py-12 text-content-tertiary">
            <Spinner size={28} />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-drive border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {result && !loading && (
          <ul className="divide-y divide-border overflow-hidden rounded-drive border border-border">
            {result.requirements.map((req) => (
              <li key={req.key} className="flex items-center gap-3 px-4 py-3">
                {req.ok ? (
                  <CheckCircle2 size={20} className="shrink-0 text-success" />
                ) : (
                  <XCircle size={20} className="shrink-0 text-danger" />
                )}
                <span className="flex-1 text-sm text-content-primary">{req.label}</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    req.ok ? 'text-content-tertiary' : 'text-danger'
                  )}
                >
                  {req.current}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" leftIcon={RefreshCw} onClick={load} disabled={loading}>
          Volver a comprobar
        </Button>
        <Button onClick={onNext} disabled={loading || !result?.can_proceed}>
          Continuar
        </Button>
      </div>
    </div>
  )
}
