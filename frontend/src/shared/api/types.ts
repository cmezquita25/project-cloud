/** Envelope uniforme de la API: { success, data, error }. */
export interface ApiEnvelope<T> {
  success: boolean
  data: T | null
  error: ApiErrorPayload | null
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}
