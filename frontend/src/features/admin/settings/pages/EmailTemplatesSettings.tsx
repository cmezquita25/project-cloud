import { useEffect, useRef, useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'
import { Button, Input, Spinner, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { cn } from '@shared/lib/cn'
import { adminApi } from '../../services/adminApi'
import type { EmailTemplate } from '../../types'

interface Draft {
  subject: string
  body_html: string
}

/** Editor de plantillas de correo con variables e previsualización con marca. */
export function EmailTemplatesSettings() {
  const toast = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [activeKey, setActiveKey] = useState<string>('')
  const [draft, setDraft] = useState<Draft>({ subject: '', body_html: '' })
  const [previewHtml, setPreviewHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const active = templates.find((t) => t.key === activeKey) ?? null

  useEffect(() => {
    let alive = true
    adminApi
      .getEmailTemplates()
      .then((list) => {
        if (!alive) return
        setTemplates(list)
        if (list[0]) {
          setActiveKey(list[0].key)
          setDraft({ subject: list[0].subject, body_html: list[0].body_html })
        }
      })
      .catch(() => toast.error('No se pudieron cargar las plantillas'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [toast])

  // Al cambiar de plantilla, recarga el borrador y refresca la vista previa.
  const selectTemplate = (t: EmailTemplate) => {
    setActiveKey(t.key)
    setDraft({ subject: t.subject, body_html: t.body_html })
    setPreviewHtml('')
  }

  const refreshPreview = async () => {
    if (!activeKey) return
    setPreviewing(true)
    try {
      const res = await adminApi.previewEmailTemplate(activeKey, draft)
      setPreviewHtml(res.html)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo generar la vista previa')
    } finally {
      setPreviewing(false)
    }
  }

  // Genera la vista previa inicial al elegir una plantilla.
  useEffect(() => {
    if (activeKey) void refreshPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  const insertVariable = (name: string) => {
    const token = `{{${name}}}`
    const el = bodyRef.current
    if (!el) {
      setDraft((d) => ({ ...d, body_html: d.body_html + token }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + token + el.value.slice(end)
    setDraft((d) => ({ ...d, body_html: next }))
    // Recoloca el cursor tras el token insertado.
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }

  const save = async () => {
    if (!activeKey) return
    setSaving(true)
    try {
      await adminApi.updateEmailTemplate(activeKey, draft)
      setTemplates((prev) => prev.map((t) => (t.key === activeKey ? { ...t, ...draft } : t)))
      toast.success('Plantilla guardada')
      void refreshPreview()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la plantilla')
    } finally {
      setSaving(false)
    }
  }

  const restore = async () => {
    if (!activeKey) return
    try {
      const res = await adminApi.resetEmailTemplate(activeKey)
      const restored = { subject: res.subject, body_html: res.body_html }
      setDraft(restored)
      setTemplates((prev) => prev.map((t) => (t.key === activeKey ? { ...t, ...restored } : t)))
      toast.success('Plantilla restaurada al valor por defecto')
      void refreshPreview()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo restaurar la plantilla')
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-content-tertiary">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-lg font-medium text-content-primary">Plantillas de correo</h2>
        <p className="text-sm text-content-secondary">
          Personaliza el asunto y el contenido de los correos que envía la plataforma.
        </p>
      </div>

      {/* Selector de plantilla */}
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTemplate(t)}
            className={cn(
              'rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
              t.key === activeKey
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border text-content-secondary hover:bg-surface-hover'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-4 rounded-drive border border-border bg-surface p-4">
            <p className="text-sm text-content-tertiary">{active.description}</p>

            <Input
              label="Asunto"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tpl-body" className="text-sm font-medium text-content-secondary">
                Cuerpo (HTML)
              </label>
              <textarea
                id="tpl-body"
                ref={bodyRef}
                rows={12}
                value={draft.body_html}
                onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
                className="w-full resize-y rounded-drive border border-border-strong bg-surface px-3.5 py-2.5 font-mono text-xs text-content-primary placeholder:text-content-tertiary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-content-secondary">
                Variables disponibles (clic para insertar)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {active.variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="rounded-md border border-border bg-surface-container px-2 py-0.5 font-mono text-xs text-content-secondary hover:border-primary hover:text-primary"
                  >
                    {'{{'}
                    {v}
                    {'}}'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <Button onClick={save} loading={saving}>
                Guardar plantilla
              </Button>
              <Button variant="secondary" leftIcon={Eye} onClick={refreshPreview} disabled={previewing}>
                Actualizar vista previa
              </Button>
              <Button variant="ghost" leftIcon={RotateCcw} onClick={restore}>
                Restaurar default
              </Button>
            </div>
          </div>

          {/* Vista previa */}
          <div className="flex flex-col rounded-drive border border-border bg-surface-container p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-content-secondary">Vista previa</p>
              {previewing && <Spinner size={16} className="text-content-tertiary" />}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white">
              <iframe
                title="Vista previa del correo"
                srcDoc={previewHtml}
                className="h-full min-h-[420px] w-full border-0"
                sandbox=""
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
