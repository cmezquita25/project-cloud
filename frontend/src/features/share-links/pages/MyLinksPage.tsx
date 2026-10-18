import { LinksPanel } from '../components/LinksPanel'

/** «Mis enlaces compartidos»: los enlaces y QR que creó el usuario. */
export function MyLinksPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-content-primary">Mis enlaces compartidos</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Los enlaces y QR que creaste: cuántas veces se abrieron, cuándo caducan, y revócalos cuando ya no los necesites.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-12 [scrollbar-gutter:stable]">
        <LinksPanel mode="mine" />
      </div>
    </div>
  )
}
