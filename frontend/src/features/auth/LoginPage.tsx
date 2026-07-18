import { useState, type FormEvent } from 'react'
import { Mail, Lock } from 'lucide-react'
import { Button, Input } from '@shared/ui'

/**
 * Pantalla de inicio de sesión (maqueta).
 * La lógica de autenticación (JWT + refresh) se implementa en la Fase 3.
 */
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Fase 3: llamar a POST /auth/login
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-medium text-content-primary">Inicia sesión</h1>
        <p className="mt-1 text-sm text-content-secondary">Accede a tu almacenamiento</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          leftIcon={Mail}
          placeholder="tucorreo@techmaleon.mx"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          label="Contraseña"
          type="password"
          leftIcon={Lock}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" fullWidth size="lg">
          Entrar
        </Button>
      </form>
    </div>
  )
}
