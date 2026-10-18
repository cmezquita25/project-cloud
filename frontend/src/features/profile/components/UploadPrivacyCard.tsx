import { useState } from 'react'
import { Globe, LockKeyhole } from 'lucide-react'
import { useToast } from '@shared/ui'
import { cn } from '@shared/lib/cn'
import { useAuth } from '@features/auth/AuthProvider'
import { authApi } from '@features/auth/services/authApi'
import type { User } from '@features/auth/types'

type Visibility = NonNullable<User['default_visibility']>

const OPTIONS: { value: Visibility; title: string; detail: string; icon: typeof Globe }[] = [
  {
    value: 'public',
    title: 'Públicas',
    detail: 'Cada archivo tiene su URL directa, ideal para usarla en webs o en código.',
    icon: Globe,
  },
  {
    value: 'private',
    title: 'Privadas',
    detail: 'Sin URL pública: solo tú y quienes tengan acceso pueden verlas.',
    icon: LockKeyhole,
  },
]

/**
 * Visibilidad por defecto de las subidas nuevas. Lo que se sube dentro de una
 * carpeta privada es privado siempre, elijas lo que elijas aquí.
 */
export function UploadPrivacyCard() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState<Visibility | null>(null)
  if (!user) return null
  const current: Visibility = user.default_visibility ?? 'public'

  const choose = async (value: Visibility) => {
    if (value === current) return
    setSaving(value)
    try {
      setUser(await authApi.updateProfile({ default_visibility: value }))
      toast.success(value === 'private' ? 'Tus subidas nuevas serán privadas' : 'Tus subidas nuevas serán públicas')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la preferencia')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="lg:col-span-12 rounded-drive glass p-6 transition-all hover:border-border-strong">
      <h3 className="text-base font-medium text-content-primary">Privacidad de mis subidas</h3>
      <p className="mt-1 text-sm text-content-secondary">
        Cómo se crean tus archivos nuevos. Siempre puedes cambiar cada archivo o carpeta después desde su menú.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Visibilidad de las subidas nuevas">
        {OPTIONS.map((o) => {
          const active = current === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving !== null}
              onClick={() => choose(o.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60',
                active ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'
              )}
            >
              <o.icon size={20} className={cn('mt-0.5 shrink-0', active ? 'text-primary' : 'text-content-tertiary')} />
              <span>
                <span className="block text-sm font-medium text-content-primary">{o.title}</span>
                <span className="text-xs text-content-secondary">{o.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-content-tertiary">Lo que subas dentro de una carpeta privada siempre será privado.</p>
    </div>
  )
}
