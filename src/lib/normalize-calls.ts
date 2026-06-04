import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { ChainId } from '@sectorone/sdk-core'
import {
  LB_ROUTER_ADDRESS,
  LB_ROUTER_V22_ADDRESS,
  LIQUIDITY_HELPER_V2_ADDRESS
} from '@sectorone/sdk-v2'
import type { BaseMcpPayload, RawUnsignedCall } from './types.js'
import { SectorOneError } from './errors.js'

const HEX_DATA = /^0x([0-9a-fA-F]{2})*$/
const ZERO = '0x0000000000000000000000000000000000000000'
const APPROVE_SELECTOR = '0x095ea7b3'

const KNOWN_TARGETS = new Set(
  [
    LB_ROUTER_ADDRESS[ChainId.BASE],
    LB_ROUTER_V22_ADDRESS[ChainId.BASE],
    LIQUIDITY_HELPER_V2_ADDRESS[ChainId.BASE]
  ]
    .filter((a) => a && a.toLowerCase() !== ZERO)
    .map((a) => a.toLowerCase())
)

export type CallRisk = {
  index: number
  to: Address
  selector: string
  value: string
  knownTarget: boolean
  isApprove: boolean
  /** A call is considered known when it is an ERC-20 approve or targets a known SectorOne contract. */
  known: boolean
}

function selectorOf(data: Hex): string {
  return data.length >= 10 ? data.slice(0, 10) : '0x'
}

/** Derive a per-call risk summary for the normalized Base MCP payload. */
export function analyzeCalls(payload: BaseMcpPayload): CallRisk[] {
  return payload.calls.map((call, index) => {
    const selector = selectorOf(call.data)
    const knownTarget = KNOWN_TARGETS.has(call.to.toLowerCase())
    const isApprove = selector === APPROVE_SELECTOR
    return {
      index,
      to: call.to,
      selector,
      value: call.value,
      knownTarget,
      isApprove,
      known: knownTarget || isApprove
    }
  })
}

function toHexValue(value: RawUnsignedCall['value'], index: number): `0x${string}` {
  if (value === undefined || value === null) return '0x0'
  let asBig: bigint
  try {
    asBig = typeof value === 'bigint' ? value : BigInt(value)
  } catch {
    throw new SectorOneError(
      'INVALID_CALL',
      `Call at index ${index} has an invalid "value": ${String(value)}.`
    )
  }
  if (asBig < 0n) {
    throw new SectorOneError(
      'INVALID_CALL',
      `Call at index ${index} has a negative "value".`
    )
  }
  if (asBig === 0n) return '0x0'
  return `0x${asBig.toString(16)}` as `0x${string}`
}

function toCalldata(data: RawUnsignedCall['data'], index: number): Hex {
  if (data === undefined || data === null) return '0x'
  if (typeof data !== 'string' || !HEX_DATA.test(data)) {
    throw new SectorOneError(
      'INVALID_CALL',
      `Call at index ${index} has invalid "data" (must be 0x-prefixed even-length hex).`
    )
  }
  return data as Hex
}

export function normalizeCalls(
  input: RawUnsignedCall[],
  options: { strict?: boolean } = {}
): BaseMcpPayload {
  const calls = input.map((raw, index) => {
    if (!raw.to || !isAddress(raw.to)) {
      throw new SectorOneError(
        'INVALID_CALL',
        `Call at index ${index} has an invalid "to" address.`
      )
    }
    return {
      to: getAddress(raw.to),
      data: toCalldata(raw.data, index),
      value: toHexValue(raw.value, index)
    }
  })

  const payload: BaseMcpPayload = { chain: 'base', calls }

  if (options.strict) {
    const unknown = analyzeCalls(payload).filter((r) => !r.known)
    if (unknown.length > 0) {
      const detail = unknown
        .map((r) => `#${r.index} to=${r.to} selector=${r.selector}`)
        .join('; ')
      throw new SectorOneError(
        'UNKNOWN_CALL_TARGET',
        `Strict mode rejected ${unknown.length} call(s) not targeting a known SectorOne contract or ERC-20 approve: ${detail}`
      )
    }
  }

  return payload
}
