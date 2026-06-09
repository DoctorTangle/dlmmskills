import { SectorOneError } from './errors.js'

/** SDK default when no custom bin range is supplied. */
export const DEFAULT_LB_BIN_COUNT = 11

/** Empirical safe max bins per remove/add tx on Base. */
export const MAX_BINS_PER_TX = 15

export const SUGGESTED_REMOVE_BATCH_SIZE = 10

export function parseBinCount(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new SectorOneError(
      'INVALID_BIN_COUNT',
      'bin-count must be an integer between 1 and 200.'
    )
  }
  return value
}

/** Center `binCount` bins around `activeId` (inclusive). */
export function centeredBinRange(activeId: number, binCount: number): [number, number] {
  const count = parseBinCount(binCount)
  const halfLo = Math.floor((count - 1) / 2)
  const halfHi = Math.ceil((count - 1) / 2)
  return [activeId - halfLo, activeId + halfHi]
}

export function binIdsInRange(range: [number, number]): number[] {
  const ids: number[] = []
  for (let id = range[0]; id <= range[1]; id++) {
    ids.push(id)
  }
  return ids
}

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) {
    throw new SectorOneError('INVALID_BATCH_SIZE', 'batch-size must be at least 1.')
  }
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size) as T[])
  }
  return chunks
}
