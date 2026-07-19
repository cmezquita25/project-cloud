import { useState, useRef, useEffect } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'
import { Button, useToast, Spinner, Input } from '@shared/ui'
import { adminApi } from '../services/adminApi'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'

function LogoUploader({ title, description, type, onUpload }: { title: string, description: string, type: 'favicon' | 'white' | 'dark' | 'mobile', onUpload: () => void }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [timestamp, setTimestamp] = useState(Date.now())

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (type === 'favicon') {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await new Promise((resolve) => {
        img.onload = () => {
          if (img.width > 512 || img.height > 512) {
            toast.error('El favicon no puede superar los 512x512 píxeles.')
            if (inputRef.current) inputRef.current.value = ''
            resolve(false)
          } else {
            resolve(true)
          }
        }
      }).then(async (valid) => {
        if (!valid) return
        await doUpload(file)
      })
    } else {
      await doUpload(file)
    }
  }

  const doUpload = async (file: File) => {
    setUploading(true)
    try {
      await adminApi.uploadLogo(type, file)
      setTimestamp(Date.now())
      toast.success(`${title} actualizado correctamente`)
      if (onUpload) onUpload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el logo')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-6 rounded-drive border border-border bg-surface p-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container border border-border-strong">
        <img 
          src={`/api/v1/settings/logo/${type}?t=${timestamp}`} 
          alt={title} 
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <ImageIcon size={32} className="hidden text-content-tertiary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-content-primary">{title}</p>
        <p className="text-sm text-content-tertiary">{description}</p>
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
          leftIcon={uploading ? undefined : Upload} 
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner size={16} className="mr-2" /> : 'Subir'}
        </Button>
      </div>
    </div>
  )
}

const SLOGAN_MAX = 150

export function PlatformSettingsTab() {
  const settings = usePlatformSettings()
  const [orgName, setOrgName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (settings?.organization_name) setOrgName(settings.organization_name)
  }, [settings?.organization_name])

  useEffect(() => {
    if (settings?.organization_slogan) setSlogan(settings.organization_slogan)
  }, [settings?.organization_slogan])

  const saveOrg = async () => {
    setSavingOrg(true)
    try {
      await adminApi.updateSettings({
        organization_name: orgName,
        organization_slogan: slogan,
      })
      toast.success('Configuración guardada. Recarga la página para ver los cambios.')
    } catch (e) {
      toast.error('Error al guardar la configuración')
    } finally {
      setSavingOrg(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <div>
        <h2 className="text-lg font-medium text-content-primary mb-1">Configuración General</h2>
        <p className="text-sm text-content-secondary mb-4">Información básica de la plataforma.</p>
        <div className="space-y-4 rounded-drive border border-border bg-surface p-4 mb-6">
          <Input
            label="Nombre de la Organización"
            placeholder="Ej. Mi Empresa S.A."
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
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
              onChange={e => setSlogan(e.target.value)}
              className="w-full resize-none rounded-drive border border-border-strong bg-surface px-3.5 py-2.5 text-content-primary placeholder:text-content-tertiary transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <p className="text-xs text-content-tertiary">
              Se muestra bajo el logo en la pantalla de inicio de sesión. {slogan.length}/{SLOGAN_MAX}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveOrg} loading={savingOrg}>Guardar</Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-content-primary mb-1">Configuración Visual</h2>
        <p className="text-sm text-content-secondary mb-6">Sube los logos de la plataforma para personalizar la interfaz.</p>
      </div>

      <div className="space-y-4">
        <LogoUploader 
          type="favicon" 
          title="Favicon" 
          description="Aparece en la pestaña del navegador. Resolución máxima recomendada de 512x512 píxeles."
          onUpload={() => {}}
        />
        <LogoUploader 
          type="white" 
          title="Logo Claro (White)" 
          description="Se utiliza cuando el tema de la aplicación está en modo oscuro."
          onUpload={() => {}}
        />
        <LogoUploader 
          type="dark" 
          title="Logo Oscuro (Dark)" 
          description="Se utiliza cuando el tema de la aplicación está en modo claro."
          onUpload={() => {}}
        />
        <LogoUploader 
          type="mobile" 
          title="Logo Móvil" 
          description="Versión compacta del logo para la vista móvil. Si no se define, se usará el logo predeterminado."
          onUpload={() => {}}
        />
      </div>
    </div>
  )
}
