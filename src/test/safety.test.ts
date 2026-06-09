import { describe, expect, it } from 'vitest'
import {
  assertInfiniteApprovalConfirmed,
  assertNativeIsWeth,
  assertNativeLiquiditySupported
} from '../lib/safety.js'
import { SectorOneError } from '../lib/errors.js'

const WETH = '0x4200000000000000000000000000000000000006'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

describe('assertNativeIsWeth', () => {
  it('passes when the native flag points at WETH', () => {
    expect(() => assertNativeIsWeth(true, WETH, '--native-in')).not.toThrow()
  })

  it('throws when the native flag points at a non-WETH token', () => {
    expect(() => assertNativeIsWeth(true, USDC, '--native-in')).toThrow(
      SectorOneError
    )
  })

  it('is a no-op when the native flag is off', () => {
    expect(() => assertNativeIsWeth(false, USDC, '--native-out')).not.toThrow()
  })
})

describe('assertInfiniteApprovalConfirmed', () => {
  it('throws when infinite approval is requested without confirmation', () => {
    expect(() => assertInfiniteApprovalConfirmed(true, false)).toThrow(
      SectorOneError
    )
  })

  it('passes when infinite approval is confirmed', () => {
    expect(() => assertInfiniteApprovalConfirmed(true, true)).not.toThrow()
  })

  it('passes when infinite approval is not requested', () => {
    expect(() => assertInfiniteApprovalConfirmed(false, false)).not.toThrow()
  })
})

describe('assertNativeLiquiditySupported', () => {
  it('blocks native flags on Base v2', () => {
    expect(() => assertNativeLiquiditySupported('v2', true, false)).toThrow(
      SectorOneError
    )
  })

  it('allows native flags on v22', () => {
    expect(() => assertNativeLiquiditySupported('v22', true, false)).not.toThrow()
  })
})
