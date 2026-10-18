import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Database, AlertTriangle } from 'lucide-react'
import { Button, Checkbox, Dialog } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import type { AvailableUpdate } from '../../services/updatesApi'

type Choice = 'system' | 'backups' | 'none'

interface Props {
  open: boolean
  onClose: () => void
  currentVersion: string
  update: AvailableUpdate
  /** Fecha de la última copia (UTC, "Y-m-d H:i:s") o null. */
  lastBackup: string | null
  starting: boolean
  onConfirm: (backup: 'system' | 'none') => void
}

function daysAgo(utc: string): number {
  const date = new Date(utc.replace(' ', 'T') + 'Z')
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function formatUtc(utc: string): string {
  return new Date(utc.replace(' ', 'T') + 'Z').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

/** «Antes de actualizar»: avisa del mantenimiento y ofrece la copia previa. */
export function PreUpdateDialog({ open, onClose, currentVersion, update, lastBackup, starting, onConfirm }: Props) {
  const navigate = useNavigate()
  const [choice, setChoice] = useState<Choice>('system')
  const [ack, setAck] = useState(false)

  const age = lastBackup ? daysAgo(lastBackup) : null
  const staleBackup = age === null || age >= 1

  const confirm = () => {
    if (choice === 'backups') {
      navigate('/admin/settings/database')
      return
    }
    onConfirm(choice)
  }

  const options: { value: Choice; title: string; detail: string; icon: typeof ShieldCheck; disabled?: boolean }[] = [
    {
      value: 'system',
      title: 'Crear copia del sistema y continuar',
      detail: 'Recomendado. Base de datos y configuración; tarda unos segundos.',
      icon: ShieldCheck,
    },
    {
      value: 'backups',
      title: 'Ir a Copias de seguridad',
      detail: 'Para hacer antes una copia completa, con los archivos de los usuarios.',
      icon: Database,
    },
    {
      value: 'none',
      title: 'Continuar sin copia nueva',
      detail: update.reversible
        ? 'Solo si ya tienes una copia reciente.'
        : 'No disponible: esta versión hace cambios irreversibles en la base de datos.',
      icon: AlertTriangle,
      disabled: !update.reversible,
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={() => !starting && onClose()}
      size="lg"
      title="Antes de actualizar"
      description={
        <>
          Vas a actualizar Project Cloud de <b>v{currentVersion}</b> a <b>v{update.version}</b>.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={starting}>
            Cancelar
          </Button>
          <Button onClick={confirm} loading={starting} disabled={choice !== 'backups' && !ack}>
            {choice === 'backups' ? 'Ir a copias de seguridad' : 'Actualizar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-content-secondary">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            La plataforma entrará en <b className="text-content-primary">modo mantenimiento</b> unos minutos y{' '}
            <b className="text-content-primary">se cerrarán todas las sesiones</b>. Los usuarios tendrán que volver a iniciar sesión.
          </li>
          <li>
            <b className="text-content-primary">Los archivos de tus usuarios no se modifican.</b> Las URLs públicas seguirán
            funcionando durante el proceso.
          </li>
          <li>Se guarda una copia del código actual para poder revertir si algo falla.</li>
        </ul>

        <p className={cn('rounded-xl border p-3', staleBackup ? 'border-amber-500/30 bg-amber-500/5' : 'border-border')}>
          <b className="text-content-primary">Te recomendamos crear una copia de seguridad antes de continuar.</b>{' '}
          {lastBackup
            ? `Tu última copia es del ${formatUtc(lastBackup)}${age === 0 ? ' (hoy)' : ` (hace ${age} ${age === 1 ? 'día' : 'días'})`}.`
            : 'No tienes ninguna copia de seguridad.'}
        </p>

        <div className="space-y-2" role="radiogroup">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                choice === o.value ? 'border-primary/50 bg-primary/5' : 'border-border',
                o.disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <input
                type="radio"
                name="backup-choice"
                className="mt-1 accent-primary"
                checked={choice === o.value}
                disabled={o.disabled}
                onChange={() => setChoice(o.value)}
              />
              <o.icon size={18} className="mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium text-content-primary">{o.title}</span>
                <span className="text-xs">{o.detail}</span>
              </span>
            </label>
          ))}
        </div>

        {choice !== 'backups' && (
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>Entiendo que la plataforma no estará disponible durante la actualización.</span>
          </label>
        )}
      </div>
    </Dialog>
  )
}
