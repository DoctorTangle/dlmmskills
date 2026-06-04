export class SectorOneError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SectorOneError'
    this.code = code
  }
}

export function isSectorOneError(err: unknown): err is SectorOneError {
  return err instanceof SectorOneError
}
