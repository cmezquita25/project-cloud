import { useState } from 'react'
import { Dialog, Button } from '@shared/ui'
import type { DriveItem } from '../../types'

interface DeleteDialogProps {
  open: boolean
  items: DriveItem[]
  onClose: () => void
  onConfirm: () => Promise<void>
}

/** Confirmación de envío a la papelera. */
export function DeleteDialog({ open, items, onClose, onConfirm }: DeleteDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const count = items.length
  const target = count === 1 ? `"${items[0]!.name}"` : `${count} elementos`

  const confirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enviar a la papelera"
      description={`Se enviará ${target} a la papelera. Podrás restaurarlo desde ahí.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm} loading={submitting}>
            Enviar a papelera
          </Button>
        </>
      }
    />
  )
}
