import { SmtpSettings } from '../../components/SmtpSettings'

/** Configuración del servidor de correo saliente (SMTP). */
export function EmailSettings() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Configuración del SMTP</h2>
        <p className="text-sm text-content-secondary">
          Servidor usado para enviar altas de cuenta, restablecimientos de contraseña y avisos.
        </p>
      </div>
      <SmtpSettings />
    </div>
  )
}
