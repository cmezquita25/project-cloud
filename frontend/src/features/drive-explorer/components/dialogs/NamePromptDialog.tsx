import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog, Button, Input } from '@shared/ui'

interface NamePromptDialogProps {
  open: boolean
  title: string
  label: string
  initialValue?: string
  confirmLabel?: string
  onClose: () => void
  onConfirm: (name: string) => Promise<void>
}

/** Diálogo de entrada de nombre (crear carpeta / renombrar). */
export function NamePromptDialog({
  open,
  title,
  label,
  initialValue = '',
  confirmLabel = 'Aceptar',
  onClose,
  onConfirm,
}: NamePromptDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setError(null)
      // Selecciona el nombre (sin extensión) al abrir.
      window.setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          const dot = initialValue.lastIndexOf('.')
          el.setSelectionRange(0, dot > 0 ? dot : initialValue.length)
        }
      }, 50)
    }
  }, [open, initialValue])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError('El nombre no puede estar vacío')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <form onSubmit={submit}>
        <Input
          ref={inputRef}
          label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error ?? undefined}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
