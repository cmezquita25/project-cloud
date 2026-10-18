import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, Dialog, Input, useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { adminApi } from '../services/adminApi'
import { ACTIVITY_RANGES, type ActivityRange } from './ActivityFilters'

/** Frase que hay que escribir para borrar TODO el registro. */
const CONFIRM_PHRASE = 'Todos los registros'

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
  range: ActivityRange
  search: string
  /** Registros que coinciden con el filtro actual. */
  filteredTotal: number
}

/**
 * Limpieza del registro de auditoría (solo admins). Se puede borrar lo que
 * muestra el filtro actual o todo; para todo hay que escribir la frase de
 * confirmación. El borrado en sí queda registrado.
 */
export function ClearActivityDialog({ open, onClose, onDone, range, search, filteredTotal }: Props) {
  const toast = useToast()
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered')
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setScope('filtered')
      setPhrase('')
    }
  }, [open])

  const rangeLabel = ACTIVITY_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? ''
  const filteredLabel = `${filteredTotal.toLocaleString()} ${filteredTotal === 1 ? 'registro' : 'registros'} de «${rangeLabel}»${search.trim() ? ` que coinciden con «${search.trim()}»` : ''}`
  const canConfirm = scope === 'filtered' ? filteredTotal > 0 : phrase.trim() === CONFIRM_PHRASE

  const confirm = async () => {
    setBusy(true)
    try {
      const { deleted } = await adminApi.clearActivity(scope, range, search)
      toast.success(`${deleted.toLocaleString()} ${deleted === 1 ? 'registro eliminado' : 'registros eliminados'}`)
      onDone()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron eliminar los registros')
    } finally {
      setBusy(false)
    }
  }

  const option = (value: 'filtered' | 'all', title: string, detail: string) => (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', scope === value ? 'border-red-500/40 bg-red-500/5' : 'border-border')}>
      <input type="radio" name="clear-scope" className="mt-1 accent-red-500" checked={scope === value} onChange={() => setScope(value)} />
      <span>
        <span className="block text-sm font-medium text-content-primary">{title}</span>
        <span className="text-xs text-content-secondary">{detail}</span>
      </span>
    </label>
  )

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Limpiar registros de auditoría"
      description="Los registros eliminados no se pueden recuperar. Quedará constancia de esta limpieza."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" leftIcon={Trash2} loading={busy} disabled={!canConfirm} onClick={confirm}>
            Eliminar
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {option('filtered', 'Solo los que se muestran', filteredLabel)}
        {option('all', 'Todos los registros', 'Vacía por completo el registro de auditoría, de cualquier fecha y usuario.')}
        {scope === 'all' && (
          <div className="pt-2">
            <Input
              label={`Para confirmar, escribe «${CONFIRM_PHRASE}»`}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoFocus
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
