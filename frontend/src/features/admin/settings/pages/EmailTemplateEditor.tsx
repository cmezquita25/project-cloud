import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { Eye, RotateCcw, ArrowLeft, CopyPlus, Save } from 'lucide-react'
import { Button, Input, Spinner, useToast, Dialog } from '@shared/ui'
import { ApiError } from '@shared/api'
import { adminApi } from '../../services/adminApi'
import type { EmailTemplate } from '../../types'

interface Draft {
  subject: string
  body_html: string
}

export function EmailTemplateEditor() {
  const { key } = useParams<{ key: string }>()
  const toast = useToast()
  
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [draft, setDraft] = useState<Draft>({ subject: '', body_html: '' })
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const queryClient = useQueryClient()
  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: () => adminApi.getEmailTemplates()
  })

  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (templates && !seeded) {
      const found = templates.find(t => t.key === key)
      if (found) {
        setTemplate(found)
        setDraft({ subject: found.subject, body_html: found.body_html })
        setSeeded(true)
      } else {
        toast.error('Plantilla no encontrada')
      }
    }
  }, [key, templates, seeded, toast])

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

  const openPreview = async () => {
    await refreshPreview()
    setShowPreviewModal(true)
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

  const handleFormatHTML = () => {
    try {
      const tab = '  '
      let result = ''
      let indent = ''
      
      const lines = draft.body_html.replace(/(>)\s*(<)(\/*)/g, '$1\n$2$3').split('\n')
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        if (line.match(/^<\/\w/)) {
          if (indent.length >= tab.length) indent = indent.substring(tab.length)
        }

        result += indent + line + '\n'

        if (line.match(/^<\w[^>]*[^\/]>$/) && !line.match(/<\w+.*<\/\w+>/) && !line.match(/<(img|hr|br|input|meta|link)/i)) {
          indent += tab
        }
      }
      setDraft(d => ({ ...d, body_html: result.trim() }))
      toast.success('HTML formateado')
    } catch (e) {
      toast.error('No se pudo formatear el código')
    }
  }

  const save = async () => {
    if (!key) return
    setSaving(true)
    try {
      await adminApi.updateEmailTemplate(key, draft)
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] })
      toast.success('Plantilla guardada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la plantilla')
    } finally {
      setSaving(false)
    }
  }

  const restore = async () => {
    if (!key) return
    if (!confirm('¿Estás seguro de que deseas descartar tus cambios y restaurar el diseño por defecto?')) return
    try {
      const res = await adminApi.resetEmailTemplate(key)
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] })
      setDraft({ subject: res.subject, body_html: res.body_html })
      toast.success('Plantilla restaurada al valor por defecto')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo restaurar la plantilla')
    }
  }

  if (isLoading) return <div className="flex justify-center p-12"><Spinner size={28} /></div>
  if (!template) return <div className="p-8 text-center text-content-secondary">No se encontró la plantilla solicitada.</div>

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-6">
      {/* Header Superior: Botones de navegación y acciones */}
      <div className="flex shrink-0 flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Link to="/admin/settings/email-templates" className="p-2 -ml-2 rounded-full hover:bg-surface-hover text-content-secondary transition-colors" title="Volver a plantillas">
              <ArrowLeft size={20} />
            </Link>
            <h2 className="text-2xl font-semibold text-content-primary">{template.label}</h2>
          </div>
          <p className="text-sm text-content-secondary ml-9">{template.description}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button leftIcon={Save} onClick={save} loading={saving}>Guardar Plantilla</Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row gap-6 min-h-0">
        {/* Editor (Izq) */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-container/30">
            <Input
              label="Asunto del correo"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />
          </div>
          <div className="flex-1 flex flex-col p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
              <label className="text-sm font-medium text-content-secondary">Código HTML del Cuerpo</label>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleFormatHTML}>Formatear código</Button>
                <Button variant="secondary" size="sm" leftIcon={Eye} onClick={openPreview} loading={previewing}>Vista Previa</Button>
              </div>
            </div>
            <textarea
              ref={bodyRef}
              value={draft.body_html}
              onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
              className="flex-1 w-full resize-none rounded-xl border border-border bg-surface-container-highest p-4 font-mono text-sm text-content-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
              spellCheck={false}
              placeholder="<!-- Pega aquí tu diseño en HTML -->"
            />
          </div>
        </div>

        {/* Variables (Der/Abajo) */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4 min-h-0">
          <div className="flex flex-col min-h-0 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <h3 className="font-semibold text-content-primary text-base">Variables Disponibles</h3>
              <p className="text-xs text-content-secondary mt-1">Haz clic para insertar en el código en la posición actual del cursor.</p>
            </div>
            <div className="p-3 overflow-y-auto space-y-1">
              {template.variables.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="w-full flex items-center justify-between text-left p-3 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary-subtle/40 transition-all group"
                  title={`Insertar {{${v}}}`}
                >
                  <div className="flex items-center gap-2">
                    <CopyPlus size={16} className="text-content-tertiary group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-content-primary capitalize group-hover:text-primary transition-colors">{v.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-surface-container px-1.5 py-0.5 rounded text-content-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {`{{${v}}}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-auto pt-2 flex justify-center">
            <button 
              onClick={restore}
              className="text-sm text-content-secondary hover:text-danger flex items-center gap-2 transition-colors py-2 px-4 rounded-full hover:bg-danger/10"
            >
              <RotateCcw size={16} /> Restaurar plantilla default
            </button>
          </div>
        </div>
      </div>

      <Dialog open={showPreviewModal} onClose={() => setShowPreviewModal(false)} size="3xl" hideClose={false} title="Vista Previa de Correo">
        <div className="h-[600px] w-full rounded-xl overflow-hidden border border-border shadow-inner bg-[#f8fafc] mt-2 relative">
          <iframe
            title="Vista previa del correo"
            srcDoc={previewHtml}
            className="h-full w-full border-0 bg-transparent"
            sandbox=""
          />
        </div>
      </Dialog>
    </div>
  )
}
