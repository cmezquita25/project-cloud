import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { ApiError } from '@shared/api'
import { libraryApi } from '@features/library/services/libraryApi'
import { ItemCollection } from '@features/library/components/ItemCollection'

export function RecentPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['library', 'recent'],
    queryFn: ({ signal }) => libraryApi.recent(signal).then(r => r.files),
  })

  const errorMessage = error instanceof ApiError ? error.message : (error ? 'No se pudo cargar recientes' : null)

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Recientes</h1>
      <div className="min-h-0 flex-1">
        <ItemCollection
          items={data ?? []}
          loading={isLoading}
          error={errorMessage}
          reload={() => refetch()}
          showLocation
          empty={{
            icon: Clock,
            title: 'Sin actividad reciente',
            description: 'Aquí verás los archivos que subiste o modificaste recientemente.',
          }}
        />
      </div>
    </motion.div>
  )
}
