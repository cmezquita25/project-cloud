import { useState, useRef } from 'react'
import { X, Paperclip, Loader2 } from 'lucide-react'
import { Button, Dialog, useToast } from '@shared/ui'
import { supportApi } from '../services/supportApi'

interface ReportBugDialogProps {
  isOpen: boolean
  onClose: () => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function ReportBugDialog({ isOpen, onClose }: ReportBugDialogProps) {
  const [subject, setSubject] = useState('Reporte de Error')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    
    // Filter by size
    const validFiles = selectedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`El archivo ${file.name} supera el límite de 10MB.`)
        return false
      }
      return true
    })

    setFiles(prev => [...prev, ...validFiles])
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const submit = async () => {
    if (!message.trim()) {
      toast.error('Por favor ingresa un mensaje')
      return
    }

    setSending(true)
    try {
      await supportApi.report(subject, message, files)
      toast.success('Reporte enviado correctamente. ¡Gracias por tus comentarios!')
      onClose()
      setSubject('Reporte de Error')
      setMessage('')
      setFiles([])
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar el reporte. Inténtalo más tarde.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={sending ? () => {} : onClose} title="Reportar problema o sugerencia">
      <div className="space-y-4 pt-2 w-[500px] max-w-full">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            Asunto
          </label>
          <select 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-drive border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-content-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="Reporte de Error">Reportar un error (Bug)</option>
            <option value="Sugerencia">Sugerencia de mejora</option>
            <option value="Comentario General">Comentario general</option>
            <option value="Duda">Tengo una duda / Necesito ayuda</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-content-secondary">
            Descripción detallada
          </label>
          <textarea
            rows={5}
            placeholder="Describe con el mayor detalle posible tu comentario o el error encontrado..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-none rounded-drive border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Adjuntos (Opcional, Max 10MB por archivo)
          </label>
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={16} className="mr-2" />
            Añadir archivos
          </Button>

          {files.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface-container px-3 py-2 text-sm">
                  <span className="truncate flex-1" title={file.name}>{file.name}</span>
                  <span className="text-xs text-content-tertiary ml-2 shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button onClick={() => removeFile(i)} className="ml-2 text-content-tertiary hover:text-error transition-colors shrink-0">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={sending || !message.trim()}>
            {sending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Enviar reporte
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
