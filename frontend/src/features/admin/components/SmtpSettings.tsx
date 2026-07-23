import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Send, PlugZap } from 'lucide-react'
import { Button, Input, Checkbox, Spinner, useToast, Select } from '@shared/ui'
import { ApiError } from '@shared/api'
import { adminApi } from '../services/adminApi'
import type { SmtpEncryption, SmtpSettings as SmtpSettingsData } from '../types'

const EMPTY: SmtpSettingsData = {
  enabled: false,
  host: '',
  port: 587,
  user: '',
  encryption: 'tls',
  from_email: '',
  from_name: '',
  has_password: false,
  password: '',
}

const ENCRYPTIONS: { value: SmtpEncryption; label: string; port: number }[] = [
  { value: 'tls', label: 'STARTTLS (recomendado)', port: 587 },
  { value: 'ssl', label: 'SSL/TLS', port: 465 },
  { value: 'none', label: 'Sin cifrado', port: 25 },
]

/**
 * Configuración de correo saliente (SMTP) + prueba de conexión / envío.
 * Componente autónomo: se monta hoy en Configuración y encaja tal cual en el
 * futuro rediseño con pestañas verticales.
 */
export function SmtpSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  
  const { data: smtpData, isLoading } = useQuery({
    queryKey: ['admin', 'smtp'],
    queryFn: () => adminApi.getSmtp()
  })

  const [form, setForm] = useState<SmtpSettingsData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    if (smtpData) {
      setForm(smtpData)
      setTestEmail(smtpData.from_email || '')
    }
  }, [smtpData])

  const set =
    <K extends keyof SmtpSettingsData>(key: K) =>
    (value: SmtpSettingsData[K]) =>
      setForm((f) => ({ ...f, [key]: value }))

  const onEncryptionChange = (value: SmtpEncryption) => {
    const preset = ENCRYPTIONS.find((e) => e.value === value)
    setForm((f) => {
      // Ajusta el puerto solo si el actual es uno de los presets (no lo pisa si el admin lo personalizó).
      const isPresetPort = ENCRYPTIONS.some((e) => e.port === f.port)
      return { ...f, encryption: value, port: isPresetPort && preset ? preset.port : f.port }
    })
  }

  const payload = () => ({
    enabled: form.enabled,
    host: form.host.trim(),
    port: form.port,
    user: form.user.trim(),
    encryption: form.encryption,
    from_email: form.from_email.trim(),
    from_name: form.from_name.trim(),
    password: form.password,
  })

  const save = async () => {
    setSaving(true)
    try {
      const updated = await adminApi.updateSmtp(payload())
      queryClient.setQueryData(['admin', 'smtp'], updated)
      setForm(updated)
      toast.success('Configuración SMTP guardada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const runTest = async (withEmail: boolean) => {
    if (withEmail && !testEmail.trim()) {
      toast.error('Escribe un correo de destino para la prueba')
      return
    }
    setTesting(true)
    try {
      const res = await adminApi.testSmtp({ ...payload(), to: withEmail ? testEmail.trim() : undefined })
      toast.success(res.message)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Falló la prueba de conexión')
    } finally {
      setTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-content-tertiary">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="rounded-drive border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Mail size={20} />
        </div>
        <div>
          <h3 className="text-base font-medium text-content-primary">Correo saliente (SMTP)</h3>
          <p className="text-sm text-content-tertiary">
            Servidor usado para enviar altas de cuenta, restablecimientos y avisos.
          </p>
        </div>
      </div>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-content-secondary">
        <Checkbox
          id="smtp_enabled"
          checked={form.enabled}
          onChange={(e) => set('enabled')(e.target.checked)}
        />
        Habilitar envío de correos
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Servidor SMTP (host)"
            placeholder="smtp.gmail.com"
            value={form.host}
            onChange={(e) => set('host')(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-content-secondary">Cifrado</label>
          <Select
            value={form.encryption}
            onChange={(val) => onEncryptionChange(val as SmtpEncryption)}
            className="h-10 w-full rounded-drive border border-border bg-surface px-3 text-sm text-content-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus"
            options={ENCRYPTIONS}
          />
        </div>

        <Input
          label="Puerto"
          type="number"
          value={String(form.port)}
          onChange={(e) => set('port')(Number(e.target.value) || 0)}
        />

        <Input
          label="Usuario"
          placeholder="tucorreo@ejemplo.com"
          value={form.user}
          onChange={(e) => set('user')(e.target.value)}
          autoComplete="off"
        />

        <Input
          label="Contraseña"
          type="password"
          placeholder={form.has_password ? 'Sin cambios' : 'Contraseña o app password'}
          value={form.password}
          onChange={(e) => set('password')(e.target.value)}
          autoComplete="new-password"
        />

        <Input
          label="Remitente (correo)"
          placeholder="no-reply@ejemplo.com"
          value={form.from_email}
          onChange={(e) => set('from_email')(e.target.value)}
          autoComplete="off"
        />

        <Input
          label="Remitente (nombre)"
          placeholder="Nombre de tu organización"
          value={form.from_name}
          onChange={(e) => set('from_name')(e.target.value)}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="primary" onClick={save} loading={saving}>
          Guardar configuración
        </Button>
        <Button variant="secondary" leftIcon={PlugZap} onClick={() => runTest(false)} disabled={testing}>
          Probar conexión
        </Button>
      </div>

      <div className="mt-4 rounded-drive border border-border bg-surface-container p-3">
        <p className="mb-2 text-sm font-medium text-content-secondary">Enviar correo de prueba</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="destinatario@ejemplo.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button variant="secondary" leftIcon={Send} onClick={() => runTest(true)} loading={testing}>
            Enviar prueba
          </Button>
        </div>
        <p className="mt-2 text-xs text-content-tertiary">
          Se usan los valores del formulario (aunque no los hayas guardado todavía).
        </p>
      </div>
    </div>
  )
}
