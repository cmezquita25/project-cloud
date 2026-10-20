import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Folder, FolderPlus, Settings } from 'lucide-react'
import { Button, Dialog, Input, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { cn } from '@shared/lib/cn'
import { useAssetsAccess } from '../hooks/useAssetsAccess'
import { assetsApi } from '../services/assetsApi'

interface Props {
  open: boolean
  onClose: () => void
}

const FORM_ID = 'shared-unit-setup'
const VALID_NAME = /^[A-Za-z0-9_-]+$/
/** Igual que AssetsService::RESERVED_FOLDERS (el servidor vuelve a validarlo). */
const RESERVED = ['api', 'app-assets', 'storage', 'avatars', 'thumbs', 'old-files', 'var', 'cgi-bin']

/**
 * Crea la unidad compartida de la organización. En una instalación nueva la
 * carpeta configurada («assets») aún no existe: el admin la crea, elige otra
 * carpeta que ya tenga el sitio, u omite el paso (deja de sugerirse y se
 * puede crear después en Configuración → Espacio de trabajo).
 */
export function SharedUnitSetupDialog({ open, onClose }: Props) {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { access } = useAssetsAccess()
  const [step, setStep] = useState<'setup' | 'skipped'>('setup')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'create' | 'skip' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['admin', 'assets-candidates'],
    queryFn: () => assetsApi.candidates(),
    enabled: open,
  })
  const candidates = data?.folders ?? []

  useEffect(() => {
    if (open) {
      setStep('setup')
      setName(access?.folder_name || 'assets')
      setError(null)
    }
  }, [open, access?.folder_name])

  const trimmed = name.trim()
  const invalid =
    trimmed !== '' && !VALID_NAME.test(trimmed)
      ? 'Usa solo letras, números, guion y guion bajo.'
      : RESERVED.includes(trimmed.toLowerCase())
        ? 'Ese nombre lo usa una carpeta del sistema. Elige otro.'
        : null
  const exists = candidates.includes(trimmed)
  const alias = access?.folder_alias || 'Unidad compartida'

  const close = () => {
    if (!busy) onClose()
  }

  const create = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!trimmed || invalid || busy) return
    setBusy('create')
    setError(null)
    try {
      const res = await assetsApi.activate(trimmed)
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success(res.existed ? `«${res.folder_name}» ya es tu unidad compartida` : 'Unidad compartida creada')
      onClose()
      navigate('/assets')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la unidad compartida')
    } finally {
      setBusy(null)
    }
  }

  const skip = async () => {
    setBusy('skip')
    setError(null)
    try {
      await assetsApi.dismissSetup()
      await queryClient.invalidateQueries({ queryKey: ['assets', 'access'] })
      setStep('skipped')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar tu elección')
    } finally {
      setBusy(null)
    }
  }

  if (step === 'skipped') {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Lo dejamos para después"
        description="Quitamos la sugerencia de Mi unidad. Puedes crear la unidad compartida cuando quieras en Configuración → Espacio de trabajo."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="ghost"
              leftIcon={Settings}
              onClick={() => {
                onClose()
                navigate('/admin/settings/workspace')
              }}
            >
              Ir a Configuración
            </Button>
            <Button onClick={onClose}>Entendido</Button>
          </div>
        }
      />
    )
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Crea la unidad compartida de tu organización"
      description={`Un espacio común para tu equipo: tú y los usuarios que autorices suben, organizan y comparten los archivos de la organización en un solo lugar. Aparecerá en Mi unidad como «${alias}».`}
      size="md"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="ghost" onClick={skip} loading={busy === 'skip'} disabled={busy !== null}>
            Omitir, lo haré después
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            leftIcon={exists ? Folder : FolderPlus}
            loading={busy === 'create'}
            disabled={!trimmed || !!invalid || busy !== null}
          >
            {exists ? 'Usar esta carpeta' : 'Crear unidad compartida'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={create}>
        <Input
          label="Carpeta en el servidor"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          disabled={busy !== null}
          error={invalid ?? error ?? undefined}
          hint={
            exists
              ? 'Ya existe en tu sitio: se usará tal cual, con los archivos que contenga.'
              : `Se creará en la raíz del sitio: ${window.location.host}/${trimmed || 'assets'}`
          }
        />

        {candidates.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-content-secondary">O usa una carpeta que ya tiene tu sitio</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setName(folder)
                    setError(null)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs ring-1 ring-inset transition-colors',
                    folder === trimmed
                      ? 'bg-primary/15 text-primary ring-primary/30'
                      : 'text-content-secondary ring-border hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.07]'
                  )}
                >
                  <Folder size={12} />
                  {folder}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Dialog>
  )
}
