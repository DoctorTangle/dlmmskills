import { describe, expect, it } from 'vitest'
import {
  assertSlippageSafe,
  parseAddress,
  parseBinIds,
  parseBinStep,
  parseLbVersion,
  parseMaxHops,
  parseTtlSeconds,
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

  it('parseTtlSeconds enforces 1..3600 bounds', () => {
    expect(parseTtlSeconds(1200)).toBe(1200)
    expect(parseTtlSeconds(3600)).toBe(3600)
    expect(() => parseTtlSeconds(0)).toThrow(SectorOneError)
    expect(() => parseTtlSeconds(3601)).toThrow(SectorOneError)
    expect(() => parseTtlSeconds(86_400)).toThrow(SectorOneError)
  })

  it('parseBinStep accepts positive integers and rejects junk', () => {
    expect(parseBinStep(25)).toBe(25)
    expect(() => parseBinStep(0)).toThrow(SectorOneError)
    expect(() => parseBinStep(-5)).toThrow(SectorOneError)
    expect(() => parseBinStep(1.5)).toThrow(SectorOneError)
    expect(() => parseBinStep(Number.NaN)).toThrow(SectorOneError)
  })

  it('parseMaxHops constrains to 1..4', () => {
    expect(parseMaxHops(3)).toBe(3)
    expect(() => parseMaxHops(0)).toThrow(SectorOneError)
    expect(() => parseMaxHops(5)).toThrow(SectorOneError)
    expect(() => parseMaxHops(2.5)).toThrow(SectorOneError)
  })

  it('parseBinIds parses CSV integers and rejects NaN/negatives', () => {
    expect(parseBinIds('8376297, 8376298 ,8376299')).toEqual([
      8376297, 8376298, 8376299
    ])
    expect(() => parseBinIds('')).toThrow(SectorOneError)
    expect(() => parseBinIds('1,foo,3')).toThrow(SectorOneError)
    expect(() => parseBinIds('-1')).toThrow(SectorOneError)
    expect(() => parseBinIds('1.5')).toThrow(SectorOneError)
  })
})
