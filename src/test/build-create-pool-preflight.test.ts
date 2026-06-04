import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Token } from '@sectorone/sdk-core'
import { getAddress, zeroAddress } from 'viem'
import {
  assertBinStepHasPreset,
  buildCreatePoolCalls
} from '../lib/dlmm.js'
import { SectorOneError } from '../lib/errors.js'
import type { BasePublicClient } from '../lib/client.js'

const USDC = new Token(
  8453,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  6,
  'USDC',
  'USD Coin'
)
const WETH = new Token(
  8453,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether'
)

function mockClient(handlers: {
  lbPair?: `0x${string}`
  presetBaseFactor?: bigint
  presetIsOpen?: boolean
  creationUnlocked?: boolean
}): BasePublicClient {
  const pair = handlers.lbPair ?? zeroAddress
  const baseFactor = handlers.presetBaseFactor ?? 1n
  const isOpen = handlers.presetIsOpen ?? true
  const creationUnlocked = handlers.creationUnlocked ?? true

  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getLBPairInformation') {
        return {
          binStep: 25,
          LBPair: pair,
          createdByOwner: false,
          ignoredForRouting: false
        }
      }
      if (functionName === 'getPreset') {
        return [baseFactor, 0n, 0n, 0n, 0n, 0n, isOpen] as const
      }
      if (functionName === 'creationUnlocked') {
        return creationUnlocked
      }
      throw new Error(`unexpected readContract ${functionName}`)
    })
  } as unknown as BasePublicClient
}

describe('buildCreatePoolCalls preflight', () => {
  beforeEach(() => {
    vi.stubEnv('BASE_RPC_URL', 'https://example.invalid')
  })

  it('throws PAIR_ALREADY_EXISTS when factory returns a pair address', async () => {
    const client = mockClient({
      lbPair: '0x1111111111111111111111111111111111111111'
    })

    await expect(
      buildCreatePoolCalls({
        client,
        version: 'v22',
        tokenX: USDC,
        tokenY: WETH,
        binStep: 25,
        activeId: 8388608
      })
    ).rejects.toMatchObject({
      code: 'PAIR_ALREADY_EXISTS'
    } satisfies Partial<SectorOneError>)
  })

  it('throws BIN_STEP_NO_PRESET when baseFactor is zero', async () => {
    const client = mockClient({ presetBaseFactor: 0n })

    await expect(
      assertBinStepHasPreset({ client, version: 'v22', binStep: 25 })
    ).rejects.toMatchObject({ code: 'BIN_STEP_NO_PRESET' })
  })

  it('throws CREATION_LOCKED on v2 when creationUnlocked is false', async () => {
    const client = mockClient({ creationUnlocked: false })

    await expect(
      assertBinStepHasPreset({ client, version: 'v2', binStep: 25 })
    ).rejects.toMatchObject({ code: 'CREATION_LOCKED' })
  })

  it('builds one router call with zero value when pair is free', async () => {
    const client = mockClient({ lbPair: zeroAddress })

    const result = await buildCreatePoolCalls({
      client,
      version: 'v22',
      tokenX: USDC,
      tokenY: WETH,
      binStep: 25,
      activeId: 8388608
    })

    expect(result.calls).toHaveLength(1)
    expect(result.calls[0]!.value).toBe('0x0')
    expect(getAddress(result.router)).toBe(
      getAddress('0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC')
    )
    expect(result.tokenX).toBe(getAddress(WETH.address))
    expect(result.tokenY).toBe(getAddress(USDC.address))
  })
})
