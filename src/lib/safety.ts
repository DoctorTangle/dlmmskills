import { getAddress } from 'viem'
import { isWethAddress } from './tokens.js'
import { SectorOneError } from './errors.js'
import type { LbVersion } from './types.js'

/**
 * Native ETH legs only make sense for the WETH side on Base. Reject mismatches
 * early instead of building calldata that would revert or be malformed.
 */
export function assertNativeIsWeth(
  native: boolean,
  tokenAddress: string,
  flag: string
): void {
  if (native && !isWethAddress(getAddress(tokenAddress))) {
    throw new SectorOneError(
      'INVALID_NATIVE_SIDE',
      `${flag} requires that token to be WETH (0x4200000000000000000000000000000000000006), the native ETH side on Base.`
    )
  }
}

/**
 * LB Router v2.0 on Base has no addLiquidityNATIVE / removeLiquidityAVAX in its ABI.
 * Agents must wrap ETH to WETH and use standard addLiquidity / removeLiquidity.
 */
export function assertNativeLiquiditySupported(
  version: LbVersion,
  nativeX: boolean,
  nativeY: boolean
): void {
  if (version === 'v2' && (nativeX || nativeY)) {
    throw new SectorOneError(
      'NATIVE_LIQUIDITY_UNSUPPORTED',
      'LB Router v2.0 on Base does not support --native-x/--native-y (addLiquidityNATIVE). Wrap ETH to WETH via deposit() and omit native flags, or use --lb-version v22 if the pool supports native liquidity.'
    )
  }
}

/**
 * Infinite approval grants an unlimited allowance to the router. Require an
 * explicit second confirmation so it can never be the silent default in an
 * agent flow.
 */
export function assertInfiniteApprovalConfirmed(
  infinite: boolean,
  confirmed: boolean
): void {
  if (infinite && !confirmed) {
    throw new SectorOneError(
      'INFINITE_APPROVAL_UNCONFIRMED',
      'Infinite approval grants an unlimited allowance. Re-run with --confirm-infinite-approval after explicit user confirmation, or omit --infinite-approval for an exact approval.'
    )
  }
}
