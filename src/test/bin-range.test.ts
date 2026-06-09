import { describe, expect, it } from 'vitest'
import {
  centeredBinRange,
  chunkArray,
  DEFAULT_LB_BIN_COUNT,
  parseBinCount
} from '../lib/bin-range.js'
import { SectorOneError } from '../lib/errors.js'

describe('bin-range', () => {
  it('DEFAULT_LB_BIN_COUNT is 11', () => {
    expect(DEFAULT_LB_BIN_COUNT).toBe(11)
  })

  it('centeredBinRange produces 11 bins around activeId', () => {
    const [lo, hi] = centeredBinRange(1000, 11)
    expect(hi - lo + 1).toBe(11)
    expect(lo).toBe(995)
    expect(hi).toBe(1005)
  })

  it('centeredBinRange produces 50 bins', () => {
    const [lo, hi] = centeredBinRange(8388608, 50)
    expect(hi - lo + 1).toBe(50)
  })

  it('parseBinCount rejects invalid values', () => {
    expect(parseBinCount(41)).toBe(41)
    expect(() => parseBinCount(0)).toThrow(SectorOneError)
    expect(() => parseBinCount(201)).toThrow(SectorOneError)
  })

  it('chunkArray splits evenly', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
