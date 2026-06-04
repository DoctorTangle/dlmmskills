import { describe, expect, it } from 'vitest'
import { scaleLiquidityBalances } from '../lib/dlmm.js'
import {
  parseFraction,
  parseLiquidityAmountsList
} from '../lib/validation.js'
import { SectorOneError } from '../lib/errors.js'

describe('remove liquidity helpers', () => {
  it('scaleLiquidityBalances applies fraction with 6 decimal precision', () => {
    expect(scaleLiquidityBalances([1_000_000n], 0.5)).toEqual([500_000n])
    expect(scaleLiquidityBalances([1_000_000n], 1)).toEqual([1_000_000n])
  })

  it('parseFraction rejects out-of-range values', () => {
    expect(parseFraction(0.5)).toBe(0.5)
    expect(() => parseFraction(0)).toThrow(SectorOneError)
    expect(() => parseFraction(1.1)).toThrow(SectorOneError)
  })

  it('parseLiquidityAmountsList matches bin count', () => {
    expect(parseLiquidityAmountsList('100,200', 2)).toEqual([100n, 200n])
    expect(() => parseLiquidityAmountsList('100', 2)).toThrow(SectorOneError)
  })

})
