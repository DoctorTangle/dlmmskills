import { ChainId } from '@sectorone/sdk-core'
import type { LbVersion } from './types.js'
import { MAX_BINS_PER_TX, SUGGESTED_REMOVE_BATCH_SIZE } from './bin-range.js'

/** Re-export for agents/docs — empirical safe max bins per remove/add tx on Base. */
export { MAX_BINS_PER_TX, SUGGESTED_REMOVE_BATCH_SIZE }

/**
 * Whether native ETH liquidity flags are valid for add/remove on this chain + LB version.
 * P2: move to @sectorone/sdk-v2 when upstream adds chain/version matrix.
 */
export function supportsNativeLiquidity(
  chainId: number,
  version: LbVersion
): boolean {
  if (chainId !== ChainId.BASE) return false
  return version === 'v22'
}

export function assertNativeLiquiditySupportedBySdk(
  chainId: number,
  version: LbVersion,
  nativeX: boolean,
  nativeY: boolean
): void {
  if (!nativeX && !nativeY) return
  if (!supportsNativeLiquidity(chainId, version)) {
    throw new Error(
      `Native liquidity (--native-x/--native-y) is not supported on chainId ${chainId} with --lb-version ${version}. Wrap ETH to WETH and omit native flags.`
    )
  }
}
