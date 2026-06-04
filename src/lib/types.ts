import type { Address, Hex } from 'viem'

export type LbVersion = 'v2' | 'v22'

export type McpCall = {
  to: Address
  data: Hex
  value: `0x${string}`
}

export type BaseMcpPayload = {
  chain: 'base'
  calls: McpCall[]
}

export type RawUnsignedCall = {
  from?: Address
  to: Address
  data?: Hex
  value?: number | string | bigint
}

export type RouteHop = {
  pair: Address
  binStep: number
  version: LbVersion
}

export type SlippageLevel = 'normal' | 'elevated' | 'high' | 'very_high'
