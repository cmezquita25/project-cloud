import { useEffect, useState } from 'react'
import { Button, Input, useLoader, useToast } from '@shared/ui'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { adminApi } from '../../services/adminApi'

const SLOGAN_MAX = 150

/** Datos básicos de la organización (nombre y eslogan). */
export function GeneralSettings() {
  const settings = usePlatformSettings()
  const toast = useToast()
  const loader = useLoader()
  const [orgName, setOrgName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings?.organization_name) setOrgName(settings.organization_name)
  }, [settings?.organization_name])

  useEffect(() => {
    if (settings?.organization_slogan) setSlogan(settings.organization_slogan)
  }, [settings?.organization_slogan])

  const save = async () => {
    setSaving(true)
    try {
      await adminApi.updateSettings({ organization_name: orgName, organization_slogan: slogan })
      // Recarga completa para que los cambios se apliquen en toda la plataforma
      // (barra superior, título, login…), que consumen los ajustes públicos.
      loader.show('Aplicando cambios…')
      window.location.reload()
    } catch {
      toast.error('Error al guardar la configuración')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Configuración general</h2>
        <p className="mb-4 text-sm text-content-secondary">Información básica de la plataforma.</p>
        <div className="space-y-4 rounded-drive border border-border bg-surface p-4">
          <Input
            label="Nombre de la organización"
            placeholder="Ej. Mi Empresa S.A."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="org-slogan" className="text-sm font-medium text-content-secondary">
              Descripción o eslogan <span className="font-normal text-content-tertiary">(opcional)</span>
            </label>
            <textarea
              id="org-slogan"
              rows={2}
              maxLength={SLOGAN_MAX}
              placeholder="Ej. Tu nube privada y segura"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              className="w-full resize-none rounded-drive border border-border-strong bg-surface px-3.5 py-2.5 text-content-primary placeholder:text-content-tertiary transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <p className="text-xs text-content-tertiary">
              Se muestra bajo el logo en la pantalla de inicio de sesión. {slogan.length}/{SLOGAN_MAX}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
