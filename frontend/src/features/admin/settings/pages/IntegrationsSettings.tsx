import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Blocks,
  LineChart,
  CheckCircle2,
  AlertCircle,
  Zap,
  Check,
  Layers,
  Radio,
  BellRing,
  Activity,
  ShieldAlert,
} from 'lucide-react'
import { Button, Input, useToast } from '@shared/ui'
import { usePlatformSettings } from '@shared/hooks/usePlatformSettings'
import { adminApi } from '../../services/adminApi'

export function IntegrationsSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const platformSettings = usePlatformSettings()

  const [ga4Id, setGa4Id] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (platformSettings) {
      setGa4Id(platformSettings.ga4_measurement_id || '')
    }
  }, [platformSettings])

  const handleSaveGa4 = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const cleanId = ga4Id.trim().toUpperCase()
      if (cleanId && !cleanId.startsWith('G-')) {
        toast.error('El ID de Medición de GA4 debe comenzar con "G-" (ej. G-XXXXXXXXXX)')
        setSaving(false)
        return
      }

      await adminApi.updateSettings({
        ga4_measurement_id: cleanId,
        ga4_enabled: Boolean(cleanId),
      })

      toast.success('Configuración de Google Analytics guardada exitosamente')
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] })
      window.dispatchEvent(new Event('storage'))
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la integración de Google Analytics')
    } finally {
      setSaving(false)
    }
  }

  const isGa4Connected = Boolean(ga4Id && ga4Id.trim().startsWith('G-'))

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado de la Sección */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Blocks size={22} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-content-primary">Integraciones de la Plataforma</h2>
            <p className="text-sm text-content-secondary">
              Conecta tu instancia de Drive con herramientas externas de analítica, seguimiento e inteligencia.
            </p>
          </div>
        </div>
      </div>

      {/* Integración Principal: Google Analytics 4 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-content-primary flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            <span>Servicios de Analítica Activos</span>
          </h3>
        </div>

        <div className="rounded-drive border border-border bg-surface shadow-sm transition-all hover:border-border-hover overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <LineChart size={26} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-lg font-medium text-content-primary">Google Analytics 4 (GA4)</h4>
                    {isGa4Connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success border border-success/20">
                        <CheckCircle2 size={13} /> Conectado y Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-content-tertiary/10 px-2.5 py-0.5 text-xs font-medium text-content-tertiary border border-border">
                        <AlertCircle size={13} /> Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-content-secondary leading-relaxed max-w-2xl">
                    Mide en tiempo real las métricas de tráfico, usuarios únicos, usuarios recurrentes y patrones de uso en tu plataforma.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveGa4} className="mt-6 border-t border-border pt-6 space-y-4">
              <div className="max-w-xl space-y-4">
                <Input
                  label="ID de Medición de GA4 (Measurement ID)"
                  placeholder="G-XXXXXXXXXX"
                  value={ga4Id}
                  onChange={(e) => setGa4Id(e.target.value)}
                  hint="Copia tu ID de Medición desde Google Analytics (Flujos de datos web)."
                />
              </div>

              <div className="flex justify-start pt-2">
                <Button type="submit" loading={saving} leftIcon={Check}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Catálogo de Próximas Integraciones */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-content-primary flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <span>Próximamente Nuevas Integraciones</span>
            </h3>
            <p className="text-xs text-content-secondary mt-0.5">
              Estamos expandiendo el ecosistema de conectores nativos para tu plataforma.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Google Tag Manager */}
          <div className="rounded-drive border border-border bg-surface p-5 opacity-90 transition-all hover:border-border-hover">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Layers size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-content-primary">Google Tag Manager (GTM)</h4>
                  <p className="text-xs text-content-tertiary">Gestor centralizado de contenedores</p>
                </div>
              </div>
              <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary">
                Próximamente
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-content-secondary">
              Inyecta y administra etiquetas de marketing, píxeles de conversión y scripts personalizados sin tocar código.
            </p>
          </div>

          {/* Card 2: Webhooks HTTP */}
          <div className="rounded-drive border border-border bg-surface p-5 opacity-90 transition-all hover:border-border-hover">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <Radio size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-content-primary">Webhooks del Sistema</h4>
                  <p className="text-xs text-content-tertiary">Slack, Zapier, Make & n8n</p>
                </div>
              </div>
              <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary">
                Próximamente
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-content-secondary">
              Notificaciones HTTP automáticas hacia endpoints externos en eventos de subida, compartición o registros.
            </p>
          </div>

          {/* Card 3: Monitoreo Sentry */}
          <div className="rounded-drive border border-border bg-surface p-5 opacity-90 transition-all hover:border-border-hover">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-content-primary">Monitoreo de Errores (Sentry)</h4>
                  <p className="text-xs text-content-tertiary">Telemetría de excepciones en tiempo real</p>
                </div>
              </div>
              <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary">
                Próximamente
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-content-secondary">
              Captura automática de excepciones en frontend/backend y diagnósticos de rendimiento.
            </p>
          </div>

          {/* Card 4: Notificaciones Telegram */}
          <div className="rounded-drive border border-border bg-surface p-5 opacity-90 transition-all hover:border-border-hover">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                  <BellRing size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-content-primary">Bot de Telegram & Alerting</h4>
                  <p className="text-xs text-content-tertiary">Alertas críticas instantáneas</p>
                </div>
              </div>
              <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary">
                Próximamente
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-content-secondary">
              Recibe reportes de uso, alertas de espacio en servidor e inicios de sesión administrativos en Telegram.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
