import { useEffect, useState } from 'react'
import { Link2, Save } from 'lucide-react'
import { Button, Checkbox, Input, Spinner, useToast } from '@shared/ui'
import { linksApi } from '../services/linksApi'
import type { LinkPolicy } from '../types'

/**
 * Configuración → Espacio de trabajo → «Enlaces compartidos»: políticas que
 * aplican al crear o editar enlaces (los existentes no cambian; para cortarlos
 * está «Revocar todos» en Administración → Enlaces).
 */
export function LinkPolicyCard() {
  const toast = useToast()
  const [policy, setPolicy] = useState<LinkPolicy | null>(null)
  const [maxDays, setMaxDays] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    linksApi
      .policy()
      .then((p) => {
        setPolicy(p)
        setMaxDays(String(p.max_expiry_days))
      })
      .catch(() => toast.error('No se pudieron cargar las políticas de enlaces.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!policy) return
    const days = Number(maxDays)
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      toast.error('La caducidad máxima debe ser un número de días entre 0 y 3650.')
      return
    }
    setSaving(true)
    try {
      const saved = await linksApi.savePolicy({ ...policy, max_expiry_days: days })
      setPolicy(saved)
      setMaxDays(String(saved.max_expiry_days))
      toast.success('Políticas de enlaces guardadas')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const limited = Number(maxDays) > 0

  return (
    <div className="rounded-xl glass p-6">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-content-primary">
        <Link2 size={18} className="text-primary" /> Enlaces compartidos
      </h3>
      <p className="mb-4 text-sm text-content-secondary">
        Reglas para los enlaces y QR que crean los usuarios. Se aplican al crear o editar un enlace; los que ya existen no
        cambian (para cortarlos usa «Revocar todos» en Administración → Enlaces).
      </p>

      {!policy ? (
        <div className="flex justify-center py-6">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={policy.enabled} onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium text-content-primary">Permitir enlaces compartidos</span>
              <span className="block text-xs text-content-tertiary">
                Si lo desactivas, nadie puede crear enlaces y los existentes dejan de abrir mientras tanto (no se revocan).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={policy.allow_anyone} disabled={!policy.enabled} onChange={(e) => setPolicy({ ...policy, allow_anyone: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium text-content-primary">Permitir «Cualquiera con el enlace»</span>
              <span className="block text-xs text-content-tertiary">Si lo desactivas, solo se pueden crear enlaces para miembros de la organización.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={policy.allow_never && !limited}
              disabled={!policy.enabled || limited}
              onChange={(e) => setPolicy({ ...policy, allow_never: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-content-primary">Permitir enlaces «Sin caducidad»</span>
              <span className="block text-xs text-content-tertiary">
                {limited ? 'No aplica con una caducidad máxima definida.' : 'Si lo desactivas, todo enlace nuevo debe tener fecha de caducidad.'}
              </span>
            </span>
          </label>
          <div className="max-w-xs">
            <Input
              type="number"
              min={0}
              max={3650}
              label="Caducidad máxima (días)"
              hint="0 = sin límite"
              value={maxDays}
              disabled={!policy.enabled}
              onChange={(e) => setMaxDays(e.target.value)}
            />
          </div>
          <div className="border-t border-border pt-4">
            <Button leftIcon={Save} loading={saving} onClick={save}>
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
