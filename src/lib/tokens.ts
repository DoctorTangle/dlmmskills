import { ChainId, Token, WNATIVE } from '@sectorone/sdk-core'
import { getAddress, type Address } from 'viem'

export const BASE_CHAIN_ID = 8453 as const
export const WETH_ADDRESS =
  '0x4200000000000000000000000000000000000006' as Address
export const USDC_ADDRESS =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address

export function makeToken(params: {
  address: string
  decimals: number
  symbol?: string
  name?: string
}): Token {
  return new Token(
    ChainId.BASE,
    getAddress(params.address),
    params.decimals,
    params.symbol,
    params.name
  )
}

export function defaultBaseTokens(): Token[] {
  return [WNATIVE[ChainId.BASE], makeToken({ address: USDC_ADDRESS, decimals: 6, symbol: 'USDC' })]
}

export function isWethAddress(address: Address): boolean {
  return getAddress(address) === getAddress(WETH_ADDRESS)
}

/**
 * Parse a `--base-token` CLI value into a Token.
 * Accepts `0xaddress` (defaults to 18 decimals) or `0xaddress:decimals`.
 * Hardcoding 18 decimals corrupts multi-hop route math for non-18-decimal
 * tokens (e.g. USDC), so decimals are explicit and validated.
 */
export function parseBaseTokenArg(value: string, index: number): Token {
  const [addr, decimalsPart] = value.split(':')
  let decimals = 18
  if (decimalsPart !== undefined && decimalsPart !== '') {
    const parsed = Number(decimalsPart)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 36) {
      throw new Error(
        `Invalid base-token decimals in "${value}". Use 0xADDRESS or 0xADDRESS:DECIMALS (0-36).`
      )
    }
    decimals = parsed
  }
  return makeToken({ address: addr ?? value, decimals, symbol: `BASE${index}` })
}
