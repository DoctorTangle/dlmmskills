import { getAddress } from 'viem'
import { isWethAddress } from './tokens.js'
import { SectorOneError } from './errors.js'

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
