import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'
import { Button, Input, useToast, Spinner } from '@shared/ui'
import { adminApi } from '@features/admin/services/adminApi'

function LogoUploader({
  title,
  description,
  type,
}: {
  title: string
  description: string
  type: 'favicon' | 'white' | 'dark' | 'mobile'
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Vista previa local inmediata (no depende del servidor para mostrarse).
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validación de resolución para el favicon.
    if (type === 'favicon') {
      const ok = await new Promise<boolean>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(!(img.width > 512 || img.height > 512))
        img.onerror = () => resolve(true)
        img.src = URL.createObjectURL(file)
      })
      if (!ok) {
        toast.error('El favicon no puede superar los 512x512 píxeles.')
        if (inputRef.current) inputRef.current.value = ''
        return
      }
    }

    setPreview(URL.createObjectURL(file))
    await doUpload(file)
  }

  const doUpload = async (file: File) => {
    setUploading(true)
    try {
      await adminApi.uploadLogo(type, file)
      toast.success(`${title} cargado`)
    } catch (err) {
      // No navegamos: el instalador se mantiene en este paso.
      toast.error(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-drive border border-border bg-surface p-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border-strong bg-surface-container">
        {preview ? (
          <img src={preview} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon size={20} className="text-content-tertiary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-content-primary">{title}</p>
        <p className="text-xs text-content-tertiary">{description}</p>
      </div>
      <div className="shrink-0">
        <input
          type="file"
          accept={type === 'favicon' ? '.ico,.png,.jpg,.jpeg' : '.png,.jpg,.jpeg,.ico'}
          className="hidden"
          ref={inputRef}
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={uploading ? undefined : Upload}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner size={16} /> : 'Subir'}
        </Button>
      </div>
    </div>
  )
}

interface StepConfigProps {
  onBack: () => void
  onDone: () => void
}

const SLOGAN_MAX = 150

export function StepConfig({ onBack, onDone }: StepConfigProps) {
  const [orgName, setOrgName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  // Guarda el nombre/eslogan (si se escribieron) y avanza. NO se dispara al
  // seleccionar imágenes: solo con el botón explícito "Guardar y finalizar".
  const handleSave = async () => {
    setSubmitting(true)
    try {
      const payload: Record<string, string> = {}
      if (orgName.trim() !== '') payload.organization_name = orgName.trim()
      if (slogan.trim() !== '') payload.organization_slogan = slogan.trim()
      if (Object.keys(payload).length > 0) {
        await adminApi.updateSettings(payload)
      }
      onDone()
    } catch (err) {
      toast.error('Error al guardar la configuración')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-medium text-content-primary">Configuración visual (opcional)</h2>
      <p className="mt-1 mb-6 text-sm text-content-secondary">
        Personaliza la plataforma con el nombre, el eslogan y los logos de tu organización.
        Puedes omitir este paso y configurarlo más tarde en el panel de Administración.
      </p>

      <div className="space-y-6">
        <Input
          label="Nombre de la Organización"
          placeholder="Ej. Mi Empresa S.A."
          value={orgName}
          onChange={e => setOrgName(e.target.value)}
          hint="Se mostrará en la barra superior y pantalla de inicio si no subes un logo."
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="install-slogan" className="text-sm font-medium text-content-secondary">
            Descripción o eslogan <span className="font-normal text-content-tertiary">(opcional)</span>
          </label>
          <textarea
            id="install-slogan"
            rows={2}
            maxLength={SLOGAN_MAX}
            placeholder="Ej. Tu nube privada y segura"
            value={slogan}
            onChange={e => setSlogan(e.target.value)}
            className="w-full resize-none rounded-drive border border-border-strong bg-surface px-3.5 py-2.5 text-content-primary placeholder:text-content-tertiary transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
          />
          <p className="text-xs text-content-tertiary">
            Se muestra bajo el logo en la pantalla de inicio de sesión. {slogan.length}/{SLOGAN_MAX}
          </p>
        </div>

        <div className="space-y-3">
          <LogoUploader type="favicon" title="Favicon" description="Icono del navegador." />
          <LogoUploader type="white" title="Logo Claro" description="Para el tema oscuro." />
          <LogoUploader type="dark" title="Logo Oscuro" description="Para el tema claro." />
          <LogoUploader
            type="mobile"
            title="Logo Móvil"
            description="Versión reducida para pantallas pequeñas."
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={onDone} disabled={submitting}>
            Omitir
          </Button>
          <Button type="button" onClick={handleSave} loading={submitting}>
            Guardar y finalizar
          </Button>
        </div>
      </div>
    </div>
  )
}
