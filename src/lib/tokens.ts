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
