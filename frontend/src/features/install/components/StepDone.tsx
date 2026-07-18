import { CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/ui'

/** Paso 4: instalación completada. */
export function StepDone() {
  const navigate = useNavigate()

  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 size={40} strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-medium text-content-primary">¡Todo listo!</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-content-secondary">
        Project Cloud se instaló correctamente. El instalador quedó bloqueado por seguridad.
        Ya puedes iniciar sesión con tu cuenta de administrador.
      </p>
      <Button size="lg" className="mt-6" onClick={() => navigate('/login', { replace: true })}>
        Ir a iniciar sesión
      </Button>
    </div>
  )
}
