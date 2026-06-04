import { describe, expect, it } from 'vitest'
import { PoolVersion } from '@sectorone/sdk-v2'
import { resolveRouteLbVersion } from '../lib/dlmm.js'

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
