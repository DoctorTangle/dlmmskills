import { describe, expect, it } from 'vitest'
import { Bin } from '@sectorone/sdk-v2'
import {
  DEFAULT_ACTIVE_BIN_ID,
  parseActiveBinId
} from '../lib/validation.js'
import { SectorOneError } from '../lib/errors.js'

describe('create pool helpers', () => {
  it('DEFAULT_ACTIVE_BIN_ID is the LB neutral anchor', () => {
    expect(DEFAULT_ACTIVE_BIN_ID).toBe(8388608)
  })

  it('parseActiveBinId accepts uint24 range', () => {
    expect(parseActiveBinId(8388608)).toBe(8388608)
    expect(() => parseActiveBinId(-1)).toThrow(SectorOneError)
    expect(() => parseActiveBinId(16_777_216)).toThrow(SectorOneError)
  })

  it('Bin.getIdFromPrice returns a valid bin id for a target price', () => {
    const binStep = 25
    const id = Bin.getIdFromPrice(3000, binStep)
    expect(Number.isInteger(id)).toBe(true)
    expect(id).toBeGreaterThan(0)
    const implied = Bin.getPriceFromId(id, binStep)
    expect(implied).toBeGreaterThan(0)
    expect(Math.abs(implied - 3000) / 3000).toBeLessThan(0.02)
  })
})
