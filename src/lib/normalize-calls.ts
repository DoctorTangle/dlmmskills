import { getAddress, isAddress, type Hex } from 'viem'
import type { BaseMcpPayload, RawUnsignedCall } from './types.js'
import { SectorOneError } from './errors.js'

const HEX_DATA = /^0x([0-9a-fA-F]{2})*$/

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

export function normalizeCalls(input: RawUnsignedCall[]): BaseMcpPayload {
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

  return { chain: 'base', calls }
}
