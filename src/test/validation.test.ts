import { describe, expect, it } from 'vitest'
import {
  assertSlippageSafe,
  parseAddress,
  parseLbVersion,
  slippageLevel
} from '../lib/validation.js'
import { SectorOneError } from '../lib/errors.js'

describe('validation', () => {
  it('rejects invalid addresses', () => {
    expect(() => parseAddress('not-an-address')).toThrow(SectorOneError)
  })

  it('rejects v21', () => {
    expect(() => parseLbVersion('v21')).toThrow(SectorOneError)
  })

  it('flags slippage above 20% as very_high', () => {
    expect(slippageLevel(50)).toBe('normal')
    expect(slippageLevel(2001)).toBe('very_high')
    expect(assertSlippageSafe(2001)).toBe('very_high')
  })

  it('strict mode rejects very high slippage', () => {
    expect(() => assertSlippageSafe(2500, true)).toThrow(SectorOneError)
  })
})
