/** Error normalizado de la API (código estable + mensaje + detalles). */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Errores de validación por campo (cuando code === 'VALIDATION_ERROR'). */
  get fieldErrors(): Record<string, string[]> {
    return this.code === 'VALIDATION_ERROR' && this.details && typeof this.details === 'object'
      ? (this.details as Record<string, string[]>)
      : {}
  }
}
