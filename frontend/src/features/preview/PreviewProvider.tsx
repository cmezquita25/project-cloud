import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { PreviewModal } from './components/PreviewModal'
import type { DriveItem, FileItem } from '@features/drive-explorer/types'

interface PreviewContextValue {
  /** Abre el visor con una lista de elementos, posicionado en `item`. */
  open: (item: FileItem, list?: DriveItem[]) => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

interface PreviewState {
  items: FileItem[]
  index: number
}

const onlyFiles = (list: DriveItem[]): FileItem[] =>
  list.filter((i): i is FileItem => i.type === 'file')

/**
 * Provee la vista previa global (Fase 7). Cualquier vista (explorador,
 * recientes, destacados, búsqueda) puede abrir un archivo; si pasa la lista
 * visible, el visor permite navegar entre archivos con ← / →.
 */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreviewState | null>(null)

  const open = useCallback((item: FileItem, list?: DriveItem[]) => {
    const files = list ? onlyFiles(list) : [item]
    const index = Math.max(0, files.findIndex((f) => f.id === item.id))
    setState({ items: files.length > 0 ? files : [item], index })
  }, [])

  const value = useMemo<PreviewContextValue>(() => ({ open }), [open])

  return (
    <PreviewContext.Provider value={value}>
      {children}
      {state && (
        <PreviewModal
          items={state.items}
          index={state.index}
          onIndex={(i) => setState((s) => (s ? { ...s, index: i } : s))}
          onClose={() => setState(null)}
        />
      )}
    </PreviewContext.Provider>
  )
}

export function usePreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('usePreview debe usarse dentro de <PreviewProvider>')
  return ctx
}
