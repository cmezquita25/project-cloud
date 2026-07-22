import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { ApiError } from '@shared/api'
import { libraryApi } from '@features/library/services/libraryApi'
import { ItemCollection } from '@features/library/components/ItemCollection'

export function StarredPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['library', 'starred'],
    queryFn: ({ signal }) => libraryApi.starred(signal).then(r => [...r.folders, ...r.files]),
  })

  const errorMessage = error instanceof ApiError ? error.message : (error ? 'No se pudieron cargar los destacados' : null)

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      <h1 className="mb-4 text-2xl font-normal text-content-primary">Destacados</h1>
      <div className="min-h-0 flex-1">
        <ItemCollection
          items={data ?? []}
          loading={isLoading}
          error={errorMessage}
          reload={() => refetch()}
          showLocation
          empty={{
            icon: Star,
            title: 'No tienes elementos destacados',
            description: 'Marca archivos y carpetas con la estrella para encontrarlos rápido aquí.',
          }}
        />
      </div>
    </motion.div>
  )
}
