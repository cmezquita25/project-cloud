import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'
import { Button, useToast, useLoader, Spinner } from '@shared/ui'
import { adminApi } from '../services/adminApi'

export type LogoType = 'favicon' | 'white' | 'dark' | 'mobile'

interface LogoUploaderProps {
  title: string
  description: string
  type: LogoType
  onUpload?: () => void
}

/** Tarjeta de subida/reemplazo de un logo de la plataforma. */
export function LogoUploader({ title, description, type, onUpload }: LogoUploaderProps) {
  const toast = useToast()
  const loader = useLoader()
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
      onUpload?.()
      // Recarga para que el nuevo logo se aplique en toda la plataforma
      // (barra superior, login, favicon…), evitando cachés del navegador.
      loader.show('Aplicando cambios…')
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el logo')
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-6 rounded-drive border border-border bg-surface p-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-surface-container">
        <img
          src={`/api/v1/settings/logo/${type}?t=${timestamp}`}
          alt={title}
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
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
