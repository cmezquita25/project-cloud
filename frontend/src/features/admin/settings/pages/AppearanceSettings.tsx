import { LogoUploader } from '../../components/LogoUploader'
import { useEffect, useState } from 'react'
import { Button, useLoader, useToast } from '@shared/ui'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { adminApi } from '../../services/adminApi'

/** Logos de la plataforma (favicon, claro, oscuro y móvil). */
export function AppearanceSettings() {
  const settings = usePlatformSettings()
  const toast = useToast()
  const loader = useLoader()
  
  const [primaryColor, setPrimaryColor] = useState('#1a73e8')
  const [btnGradientStart, setBtnGradientStart] = useState('#1a73e8')
  const [btnGradientEnd, setBtnGradientEnd] = useState('#9333ea')
  const [btnTextColor, setBtnTextColor] = useState('#ffffff')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings?.primary_color) setPrimaryColor(settings.primary_color)
    if (settings?.btn_gradient_start) setBtnGradientStart(settings.btn_gradient_start)
    if (settings?.btn_gradient_end) setBtnGradientEnd(settings.btn_gradient_end)
    if (settings?.btn_text_color) setBtnTextColor(settings.btn_text_color)
  }, [settings])

  const saveColor = async () => {
    setSaving(true)
    try {
      await adminApi.updateSettings({ 
        primary_color: primaryColor,
        btn_gradient_start: btnGradientStart,
        btn_gradient_end: btnGradientEnd,
        btn_text_color: btnTextColor
      })
      loader.show('Aplicando cambios...')
      window.location.reload()
    } catch {
      toast.error('Error al guardar los colores')
    } finally {
      setSaving(false)
    }
  }

  const resetColors = async () => {
    setSaving(true)
    try {
      await adminApi.updateSettings({ 
        primary_color: '',
        btn_gradient_start: '',
        btn_gradient_end: '',
        btn_text_color: ''
      })
      loader.show('Restaurando colores...')
      window.location.reload()
    } catch {
      toast.error('Error al restaurar los colores')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Configuración visual</h2>
        <p className="text-sm text-content-secondary">
          Personaliza los colores y logos de la plataforma.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-1 font-medium text-content-primary">Colores de la plataforma</h3>
        <p className="mb-6 text-sm text-content-secondary">
          Define el color principal y personaliza los gradientes de los botones primarios.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-content-primary">Color primario (Global)</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-border bg-transparent p-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-content-primary">Texto del Botón</label>
            <input
              type="color"
              value={btnTextColor}
              onChange={(e) => setBtnTextColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-border bg-transparent p-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-content-primary">Botón Gradiente (Inicio)</label>
            <input
              type="color"
              value={btnGradientStart}
              onChange={(e) => setBtnGradientStart(e.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-border bg-transparent p-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-content-primary">Botón Gradiente (Fin)</label>
            <input
              type="color"
              value={btnGradientEnd}
              onChange={(e) => setBtnGradientEnd(e.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-border bg-transparent p-1"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button onClick={saveColor} disabled={saving} className="min-w-[120px]">
            {saving ? 'Guardando...' : 'Guardar colores'}
          </Button>
          <Button variant="secondary" onClick={resetColors} disabled={saving}>
            Restablecer a valores por defecto
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <LogoUploader
          type="favicon"
          title="Favicon"
          description="Aparece en la pestaña del navegador. Resolución máxima recomendada de 512x512 píxeles."
        />
        <LogoUploader
          type="white"
          title="Logo claro (white)"
          description="Se utiliza cuando el tema de la aplicación está en modo oscuro."
        />
        <LogoUploader
          type="dark"
          title="Logo oscuro (dark)"
          description="Se utiliza cuando el tema de la aplicación está en modo claro. También es el que se incrusta en los correos."
        />
        <LogoUploader
          type="mobile"
          title="Logo móvil"
          description="Versión compacta del logo para la vista móvil. Si no se define, se usará el logo predeterminado."
        />
      </div>
    </div>
  )
}
