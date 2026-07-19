import { LogoUploader } from '../../components/LogoUploader'

/** Logos de la plataforma (favicon, claro, oscuro y móvil). */
export function AppearanceSettings() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Configuración visual</h2>
        <p className="text-sm text-content-secondary">
          Sube los logos de la plataforma para personalizar la interfaz.
        </p>
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
