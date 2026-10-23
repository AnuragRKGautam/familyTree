export class DataAccessError extends Error {
  readonly code: string

  constructor(message: string, code = 'data_error') {
    super(message)
    this.name = 'DataAccessError'
    this.code = code
  }
}

export function toDataAccessError(error: unknown, fallback: string): DataAccessError {
  if (error instanceof DataAccessError) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message)
    const code =
      'code' in error && typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'supabase_error'
    return new DataAccessError(message || fallback, code)
  }
  return new DataAccessError(fallback)
}
