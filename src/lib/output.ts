export function writeJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

export function writeHuman(lines: string[]): void {
  for (const line of lines) {
    process.stdout.write(`${line}\n`)
  }
}

export function writeWarning(message: string): void {
  process.stderr.write(`[warn] ${message}\n`)
}

export function writeError(message: string): void {
  process.stderr.write(`[error] ${message}\n`)
}

export function exitWithError(message: string, code = 1): never {
  writeError(message)
  process.exit(code)
}
