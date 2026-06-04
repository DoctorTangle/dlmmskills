import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { PoolVersion } from '@sectorone/sdk-v2'
import { normalizeSwapArgs, resolveRouteLbVersion } from '../lib/dlmm.js'

const TOKEN_A = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const TOKEN_B = '0x4200000000000000000000000000000000000006'
const RECIPIENT = '0x0000000000000000000000000000000000000001'
const DEADLINE_HEX = '0x65000000'
const PATH = {
  pairBinSteps: ['0x19'],
  versions: [PoolVersion.V2_2 as unknown as number],
  tokenPath: [TOKEN_A, TOKEN_B]
}

describe('normalizeSwapArgs', () => {
  it('v2 token->token flattens the path and drops versions', () => {
    const out = normalizeSwapArgs(
      ['0x64', '0x32', PATH, RECIPIENT, DEADLINE_HEX] as never,
      'v2'
    )
    expect(out).toEqual([
      100n,
      50n,
      [25n],
      [getAddress(TOKEN_A), getAddress(TOKEN_B)],
      getAddress(RECIPIENT),
      BigInt(DEADLINE_HEX)
    ])
  })

  it('v2 native-in (4-arg layout) keeps recipient and deadline correct', () => {
    const out = normalizeSwapArgs(
      ['0x32', PATH, RECIPIENT, DEADLINE_HEX] as never,
      'v2'
    )
    expect(out).toEqual([
      50n,
      [25n],
      [getAddress(TOKEN_A), getAddress(TOKEN_B)],
      getAddress(RECIPIENT),
      BigInt(DEADLINE_HEX)
    ])
  })

  it('v22 token->token preserves the Path struct', () => {
    const out = normalizeSwapArgs(
      ['0x64', '0x32', PATH, RECIPIENT, DEADLINE_HEX] as never,
      'v22'
    ) as [bigint, bigint, Record<string, unknown>, string, bigint]
    expect(out[0]).toBe(100n)
    expect(out[1]).toBe(50n)
    expect(out[2]).toEqual({
      pairBinSteps: [25n],
      versions: [PoolVersion.V2_2],
      tokenPath: [getAddress(TOKEN_A), getAddress(TOKEN_B)]
    })
    expect(out[3]).toBe(getAddress(RECIPIENT))
    expect(out[4]).toBe(BigInt(DEADLINE_HEX))
  })

  it('v22 native-in resolves recipient at the right position', () => {
    const out = normalizeSwapArgs(
      ['0x32', PATH, RECIPIENT, DEADLINE_HEX] as never,
      'v22'
    ) as [bigint, Record<string, unknown>, string, bigint]
    expect(out[0]).toBe(50n)
    expect(out[2]).toBe(getAddress(RECIPIENT))
    expect(out[3]).toBe(BigInt(DEADLINE_HEX))
  })
})

describe('resolveRouteLbVersion', () => {
  it('maps PoolVersion.V2 to v2', () => {
    expect(
      resolveRouteLbVersion({
        route: [],
        pairs: [],
        binSteps: [],
        versions: [PoolVersion.V2],
        amounts: [],
        virtualAmountsWithoutSlippage: [],
        fees: []
      })
    ).toBe('v2')
  })

  it('maps PoolVersion.V2_2 to v22', () => {
    expect(
      resolveRouteLbVersion({
        route: [],
        pairs: [],
        binSteps: [],
        versions: [PoolVersion.V2_2],
        amounts: [],
        virtualAmountsWithoutSlippage: [],
        fees: []
      })
    ).toBe('v22')
  })
})
