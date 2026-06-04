export function parseIntOption(value: string): number {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid integer: ${value}`)
  }
  return n
}

export function collectStrings(value: string, previous: string[]): string[] {
  return previous.concat([value])
}
