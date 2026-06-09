import { describe, expect, it } from 'vitest'
import { ChainId } from '@sectorone/sdk-core'
import {
  supportsNativeLiquidity,
  MAX_BINS_PER_TX,
  SUGGESTED_REMOVE_BATCH_SIZE
} from '../lib/native-liquidity.js'

describe('native-liquidity', () => {
  it('exports bin limit constants', () => {
    expect(MAX_BINS_PER_TX).toBe(15)
    expect(SUGGESTED_REMOVE_BATCH_SIZE).toBe(10)
  })

  it('supportsNativeLiquidity on Base v22 only', () => {
    expect(supportsNativeLiquidity(ChainId.BASE, 'v22')).toBe(true)
    expect(supportsNativeLiquidity(ChainId.BASE, 'v2')).toBe(false)
  })
})
