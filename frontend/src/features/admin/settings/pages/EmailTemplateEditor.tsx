import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Eye, RotateCcw, ArrowLeft, AlignLeft } from 'lucide-react'
import { Button, Input, Spinner, useToast } from '@shared/ui'
import { ApiError } from '@shared/api'
import { adminApi } from '../../services/adminApi'
import type { EmailTemplate } from '../../types'

interface Draft {
  subject: string
  body_html: string
}

function formatHTML(html: string) {
  let formatted = ''
  let indent = ''
  const tab = '  '
  html.split(/>\s*</).forEach(function(element) {
    if (element.match(/^\/\w/)) {
      indent = indent.substring(tab.length)
    }
    formatted += indent + '<' + element + '>\r\n'
    if (element.match(/^<?\w[^>]*[^\/]$/) && !element.startsWith("input")) {
      indent += tab
    }
  })
  return formatted.substring(1, formatted.length - 3)
}

export function EmailTemplateEditor() {
  const { key } = useParams<{ key: string }>()
  const toast = useToast()
  
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [draft, setDraft] = useState<Draft>({ subject: '', body_html: '' })
  const [previewHtml, setPreviewHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let alive = true
    adminApi.getEmailTemplates().then(list => {
      if (!alive) return
      const found = list.find(t => t.key === key)
      if (found) {
        setTemplate(found)
        setDraft({ subject: found.subject, body_html: formatHTML(found.body_html) })
      } else {
        toast.error('Plantilla no encontrada')
      }
    }).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [key, toast])

  const refreshPreview = async () => {
    if (!key) return
    setPreviewing(true)
    try {
      const res = await adminApi.previewEmailTemplate(key, draft)
      setPreviewHtml(res.html)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo generar la vista previa')
    } finally {
      setPreviewing(false)
    }
  }

  // Generar vista previa cuando se carga la plantilla inicial
  useEffect(() => {
    if (template) {
      void refreshPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template])

  const handleFormatHTML = () => {
    try {
      setDraft(d => ({ ...d, body_html: formatHTML(d.body_html) }))
      toast.success('HTML formateado')
    } catch (e) {
      toast.error('No se pudo formatear el código')
    }
  }

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
    
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }

  const save = async () => {
    if (!key) return
    setSaving(true)
    try {
      await adminApi.updateEmailTemplate(key, draft)
      toast.success('Plantilla guardada')
      void refreshPreview()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la plantilla')
    } finally {
      setSaving(false)
    }
  }

  const restore = async () => {
    if (!key) return
    try {
      const res = await adminApi.resetEmailTemplate(key)
      setDraft({ subject: res.subject, body_html: res.body_html })
      toast.success('Plantilla restaurada al valor por defecto')
      void refreshPreview()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo restaurar la plantilla')
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Spinner size={28} /></div>
  if (!template) return <div className="p-8 text-center text-content-secondary">No se encontró la plantilla solicitada.</div>

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-80px)] space-y-4">
      {/* Header Superior: Botones de navegación y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/admin/settings/email-templates" className="p-2 -ml-2 rounded-full hover:bg-surface-hover text-content-secondary transition-colors" title="Volver a plantillas">
            <ArrowLeft size={20} />
          </Link>
          <Button variant="ghost" leftIcon={RotateCcw} onClick={restore}>Restaurar original</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" leftIcon={Eye} onClick={refreshPreview} disabled={previewing}>Actualizar previa</Button>
          <Button onClick={save} loading={saving}>Guardar cambios</Button>
        </div>
      </div>

      {/* Titulo de la plantilla */}
      <div className="shrink-0">
        <h2 className="text-2xl font-semibold text-content-primary">{template.label}</h2>
        <p className="text-sm text-content-secondary mt-1">{template.description}</p>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row gap-4 min-h-[500px]">
        {/* Editor (Izq) */}
        <div className="flex-1 flex flex-col rounded-drive border border-border bg-surface p-4">
          <Input
            label="Asunto del correo"
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            className="mb-4"
          />
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-content-secondary">Código HTML</label>
            <button 
              onClick={handleFormatHTML}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary-subtle px-2 py-1 rounded-md transition-colors"
            >
              <AlignLeft size={14} /> Formatear HTML
            </button>
          </div>
          <textarea
            ref={bodyRef}
            value={draft.body_html}
            onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
            className="flex-1 w-full resize-none rounded-drive border border-border-strong bg-[#1e1e1e] p-4 font-mono text-sm text-[#d4d4d4] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
            spellCheck={false}
          />
        </div>

        {/* Variables (Der/Abajo) */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col rounded-drive border border-border bg-surface-container overflow-hidden max-h-[400px] lg:max-h-none">
          <div className="p-4 border-b border-border bg-surface/50">
            <h3 className="font-medium text-content-primary text-sm">Variables Disponibles</h3>
            <p className="text-xs text-content-secondary mt-1">Haz clic para insertar en el código.</p>
          </div>
          <div className="p-4 overflow-y-auto space-y-2">
            {template.variables.map((v) => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className="w-full flex items-center justify-between text-left p-2 rounded-md border border-transparent hover:border-primary/30 hover:bg-primary-subtle/50 transition-colors group"
              >
                <span className="text-sm font-medium text-content-primary capitalize">{v.replace(/_/g, ' ')}</span>
                <span className="font-mono text-xs text-content-secondary group-hover:text-primary">
                  {`{{${v}}}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vista Previa (Abajo) */}
      <div className="h-[400px] shrink-0 rounded-drive border border-border bg-white overflow-hidden shadow-sm flex flex-col relative">
        <div className="absolute top-2 left-3 bg-surface-container/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-content-secondary flex items-center gap-2 border border-border">
          <Eye size={14} /> Vista Previa en Vivo
          {previewing && <Spinner size={12} className="text-primary" />}
        </div>
        <iframe
          title="Vista previa del correo"
          srcDoc={previewHtml}
          className="h-full w-full border-0 mt-8"
          sandbox=""
        />
      </div>
    </div>
  )
}
