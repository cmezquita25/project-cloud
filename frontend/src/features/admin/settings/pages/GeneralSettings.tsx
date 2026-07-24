import { useEffect, useState } from 'react'
import { Button, Input, useLoader, useToast } from '@shared/ui'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { getVersionLabel, getLastUpdatedLabel } from '@shared/config/version'
import { adminApi } from '../../services/adminApi'

const SLOGAN_MAX = 150

/** Datos básicos de la organización (nombre y eslogan) y soporte de la plataforma. */
export function GeneralSettings() {
  const settings = usePlatformSettings()
  const toast = useToast()
  const loader = useLoader()

  const [orgName, setOrgName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [supportEmail, setSupportEmail] = useState('')

  const [savingOrg, setSavingOrg] = useState(false)
  const [savingSupport, setSavingSupport] = useState(false)

  useEffect(() => {
    if (settings?.organization_name) setOrgName(settings.organization_name)
  }, [settings?.organization_name])

  useEffect(() => {
    if (settings?.organization_slogan) setSlogan(settings.organization_slogan)
  }, [settings?.organization_slogan])

  useEffect(() => {
    if (settings?.support_email) setSupportEmail(settings.support_email)
  }, [settings?.support_email])

  const saveOrg = async () => {
    setSavingOrg(true)
    try {
      await adminApi.updateSettings({ organization_name: orgName, organization_slogan: slogan })
      loader.show('Aplicando cambios…')
      window.location.reload()
    } catch {
      toast.error('Error al guardar la configuración de la organización')
      setSavingOrg(false)
    }
  }

  const saveSupport = async () => {
    setSavingSupport(true)
    try {
      await adminApi.updateSettings({ support_email: supportEmail })
      loader.show('Aplicando cambios…')
      window.location.reload()
    } catch {
      toast.error('Error al guardar el correo de soporte')
      setSavingSupport(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Configuración general</h2>
        <p className="text-sm text-content-secondary">Información básica de la plataforma.</p>
      </div>

      {/* Card 1: Datos de la organización */}
      <div className="space-y-4 rounded-drive border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-medium text-content-primary">Datos de la organización</h3>
        <p className="text-xs text-content-secondary -mt-2">
          Personaliza la identidad visual y marca de tu nube.
        </p>

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

        <div className="flex justify-end pt-2">
          <Button onClick={saveOrg} loading={savingOrg}>
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* Card 2: Soporte e información del sistema */}
      <div className="space-y-5 rounded-drive border border-border bg-surface p-5 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-content-primary">Soporte e información de la plataforma</h3>
          <p className="text-xs text-content-secondary">
            Configuración de contacto de asistencia técnica y detalles del sistema.
          </p>
        </div>

        <div className="space-y-4">
          <Input
            label="Correo de soporte y reportes"
            placeholder="Ej. soporte@miempresa.com"
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
          <p className="text-xs text-content-tertiary -mt-2">
            Los usuarios podrán enviar sugerencias y reportes de errores a este correo a través del formulario de la plataforma.
          </p>
          <div className="flex justify-end">
            <Button onClick={saveSupport} loading={savingSupport}>
              Guardar correo
            </Button>
          </div>
        </div>

        <hr className="border-border/60" />

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
            Información del sistema
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg bg-surface-container/50 p-4 border border-border/40">
            <div>
              <p className="text-xs text-content-tertiary">Desarrollado por</p>
              <p className="text-sm font-medium text-content-primary">Carlos Mezquita Alvarado</p>
            </div>
            <div>
              <p className="text-xs text-content-tertiary">Versión de la app</p>
              <p className="text-sm font-medium text-content-primary">{getVersionLabel()}</p>
            </div>
            <div>
              <p className="text-xs text-content-tertiary">Última actualización</p>
              <p className="text-sm font-medium text-content-primary">{getLastUpdatedLabel()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
